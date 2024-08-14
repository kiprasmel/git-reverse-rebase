import fs from "fs-extra";
import assert from "assert";

import * as git from "./util-git";
import { reverseSequencer } from "./sequencer";
import { log } from "./util";

export type Operation = OperationDeleteFile;

export type OperationDeleteFile = {
	kind: "delete_file";
	files: string[];
};

export function performOpDeleteFile(base: string, op: OperationDeleteFile) {
	const repoRelFilepaths: string[] = git.listRepoRelativeFilepaths();

	for (const fileSuffix of op.files) {
		const filepath = git.resolveRepoRelFilepath(fileSuffix, repoRelFilepaths);
		const commitsOfFileSinceBase: string[] = git.listCommitsOfFileSince(filepath, base);

		const allCommitsAreWithinBase: boolean = git.allCommitsOfFileAreWithinSince(filepath, base, commitsOfFileSinceBase);

		if (!allCommitsAreWithinBase) {
			/**
			 * TODO continue with others, allow fixing this later
			 */
			const msg = `file contains commits outside of provided base (base "${base}", file "${fileSuffix}" ("${filepath}")).`;
			throw new Error(msg);
		}

		log({ filepath, commitsOfFileSinceBase });

		let currentRelFilepath: string = filepath;

		reverseSequencer({
			base,
			commits: commitsOfFileSinceBase,
			actionOnCommit: ({ commit }) => {
				/** 
				 * TODO: if rebasing on older .gitignore,
				 * meanwhile we have newer content,
				 * will probably throw error?
				 * 
				 * need to ensure "has uncommitted changes", not "has untracked changes".
				 */
				// git.ensureRepoStateClean();

				const exists: boolean = fs.existsSync(currentRelFilepath);

				if (!exists) {
					const differsFromOrig: boolean = currentRelFilepath !== filepath;
					const originalFileInfo = !differsFromOrig ? "" : `, originally "${filepath}"`

					const msg: string = [
						`file is affected by commit, but within commit, file not found.`,
						`(file "${currentRelFilepath}"${originalFileInfo})`,
					].join("\n") + "\n";
					throw new Error(msg);
				}

				const rename = git.didCommitRenameFile(currentRelFilepath, commit);

				fs.unlinkSync(currentRelFilepath);
				git.addGlobalChanges(currentRelFilepath);
				git.amendCommit();

				if (rename) {
					/**
					 * the commit renamed from A to B,
					 * and our file is currently named B.
					 * 
					 * we want to undo the rename,
					 * so we rename our file B to A.
					 */

					log({ currentRelFilepath, rename });
					assert.deepStrictEqual(rename.to, currentRelFilepath);
					currentRelFilepath = rename.from;
				}
			}
		});
	}
}

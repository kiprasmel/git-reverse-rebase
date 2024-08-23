import fs from "fs-extra";
import assert from "assert";

import * as git from "./util-git";
import { reverseSequencer } from "./sequencer";
import { log } from "./util";
import { FileModPair, MOD, Mod, ModCommitPair, ModHistories, getFileModHistories } from "./file-history";
import { GitReverseRebaseOpts } from "./opts";

export type Operation = OperationDeleteFile;

export type OperationDeleteFile = {
	kind: "delete_file";
	files: string[];
};

export type PerformOpDeleteFileOpts = Pick<GitReverseRebaseOpts, "base" | "dropEmpty" | "batchFiles">;

export function performOpDeleteFile({ base, dropEmpty, batchFiles }: PerformOpDeleteFileOpts, op: OperationDeleteFile): void {
	const repoRelFilepaths: string[] = git.listRepoRelativeFilepaths();
	
	if (batchFiles) {
		opDeleteFilesBatch({ base, dropEmpty, op, repoRelFilepaths });
	} else {
		opDeleteFilesNoBatch({ base, dropEmpty, op, repoRelFilepaths });
	}
}

type OpDeleteFilesBatchCtx = {
	op: OperationDeleteFile;
	repoRelFilepaths: string[];
} & Pick<GitReverseRebaseOpts, "base" | "dropEmpty">;

function opDeleteFilesBatch({ op, repoRelFilepaths, base, dropEmpty }: OpDeleteFilesBatchCtx): void {
	const modHists: ModHistories = getFileModHistories({ sinceCommittish: base });
	const commitsWithFileMods = [...modHists.commit2fileModsMap];
	const commits: string[] = commitsWithFileMods.map(x => x[0]);

	const getModCommitPairs: GetModCommitPairs = (fp) => modHists.file2modsMap.get(fp)!;
	const resolvedFilepaths: string[] = [];

	for (const fileSuffix of op.files) {
		const { filepath } = ensureAllCommitsOfFileAreWithinBase(fileSuffix, repoRelFilepaths, base, getModCommitPairs);
		resolvedFilepaths.push(filepath);
	}

	const orig2currFilepath: Map<string, string> = new Map(resolvedFilepaths.map(x => [x, x]));

	reverseSequencer({
		base,
		dropEmpty,
		commits,
		actionOnCommit: ({ commit }) => {
			const fileModPairs: FileModPair[] = modHists.commit2fileModsMap.get(commit)!;
			let shouldAmendCommit = false;
			
			for (const filepath of resolvedFilepaths) {
				const fileMod = fileModPairs.find(x => x[0] === filepath);
				if (!fileMod) continue; /** file not included in current commit */

				const mod: Mod = fileMod[1];
				const currentFilepath: string = orig2currFilepath.get(filepath)!;
				const ret = deleteFileAtCommit({ commit, mod, currentFilepath });

				if (ret.currentFilepath !== currentFilepath) orig2currFilepath.set(filepath, ret.currentFilepath);
				shouldAmendCommit ||= ret.shouldAmendCommit;
			}

			if (shouldAmendCommit) {
				git.amendCommit("--allow-empty");
			}
		}
	});
}

type OpDeleteFilesNoBatchCtx = OpDeleteFilesBatchCtx;

function opDeleteFilesNoBatch({ base, dropEmpty, op, repoRelFilepaths }: OpDeleteFilesNoBatchCtx): void {
	/**
	 * very expensive -- has to walk full history of all files from base till head,
	 * and since we'll be calling in a loop for each file, we'll do it everytime too.
	 * 
	 * and we cannot optimize the "calling for each file" part either:
	 * the SHAs get rewritten on each rebase, and since we don't batch files,
	 * each file has to get the updated modCommitPairs, because otherwise the SHAs wouldn't match.
	 */
	const getModCommitPairs: GetModCommitPairs = (fp) => git.listModificationsOfFile(fp, base);

	for (const fileSuffix of op.files) {
		const { filepath, modCommitPairs, commitsOfFileSinceBase } = ensureAllCommitsOfFileAreWithinBase(fileSuffix, repoRelFilepaths, base, getModCommitPairs);

		log({ filepath, modCommitPairs });

		let currentFilepath: string = filepath;

		reverseSequencer({
			base,
			dropEmpty,
			commits: commitsOfFileSinceBase,
			actionOnCommit: ({ commit }) => {
				const mod: Mod = modCommitPairs.find(x => x[1] === commit)![0];

				const ret = deleteFileAtCommit({ commit, mod, currentFilepath });
				currentFilepath = ret.currentFilepath;

				if (ret.shouldAmendCommit) {
					/**
					 * allow empty commits to avoid interruptions.
					 * the keeping/dropping logic is handled in the sequencer itself.
					 */
					git.amendCommit("--allow-empty");
				}
			}
		});
	}
}

type ResolvedFileWithMods = {
	filepath: string;
	modCommitPairs: ModCommitPair[];
	commitsOfFileSinceBase: string[];
}

type GetModCommitPairs = (filepath: string) => ModCommitPair[];

/**
 * TODO continue with succeeded files,
 * allow fixing failed files later.
 */
function ensureAllCommitsOfFileAreWithinBase(fileSuffix: string, repoRelFilepaths: string[], base: string, getModCommitPairs: GetModCommitPairs): ResolvedFileWithMods {
	const filepath = git.resolveRepoRelFilepath(fileSuffix, repoRelFilepaths, base);
	const modCommitPairs: ModCommitPair[] = getModCommitPairs(filepath);
	const commitsOfFileSinceBase: string[] = modCommitPairs.map((x) => x[1]);

	const allCommitsAreWithinBase: boolean = git.allCommitsOfFileAreWithinSince(filepath, base, commitsOfFileSinceBase);

	if (!allCommitsAreWithinBase) {
		const msg = `file contains commits outside of provided base (base "${base}", file "${fileSuffix}" ("${filepath}")).`;
		throw new Error(msg);
	}

	return { filepath, modCommitPairs, commitsOfFileSinceBase };
}

type DeleteFileAtCommitCtx = {
	commit: string;
	mod: Mod;
	currentFilepath: string;
};

function deleteFileAtCommit({ commit, mod, currentFilepath }: DeleteFileAtCommitCtx) {
	const exists: boolean = fs.existsSync(currentFilepath);
	const commitAlreadyDeletedTheFile: boolean = mod === MOD.delete;

	if (!exists && !commitAlreadyDeletedTheFile) {
		const msg: string = [
			`file is affected by commit, but within commit, file not found.`,
			`(file "${currentFilepath}")`,
		].join("\n") + "\n";
		throw new Error(msg);
	}

	/** read info before modifying commit */
	const rename = git.didCommitRenameFile(currentFilepath, commit);

	let shouldAmendCommit = false;

	if (!commitAlreadyDeletedTheFile) {
		fs.unlinkSync(currentFilepath);
		git.addGlobalChanges(currentFilepath);
		shouldAmendCommit = true;
	}

	if (rename) {
		/**
		 * the commit renamed from A to B,
		 * and our file is currently named B.
		 *
		 * we want to undo the rename,
		 * so we rename our file B to A.
		 */
		log({ currentFilepath, rename });
		assert.deepStrictEqual(rename.to, currentFilepath);
		currentFilepath = rename.from;
	}

	return {
		currentFilepath,
		shouldAmendCommit,
	}
}

import fs from "fs-extra";
import path from "path";
import cp from "child_process";
import assert from "assert";

import * as git from "./util-git";

export function launchFakeRebaseToGetRebaseTodoLines(base: string, restArgs: string = ""): string[] {
	try {
		cp.execSync(`git rebase --interactive ${base} ${restArgs} 2>/dev/null`, {
			env: {
				/**
				 * $1 is the temporarily created `.git/rebase-merge/git-rebase-todo` file,
				 * which will be deleted before the rebase finishes.
				 * 
				 * thus, we print it to stdout.
				 * we then exit with non-zero status
				 * to prevent rebase from actually happening.
				 */
				GIT_SEQUENCE_EDITOR: `cat "$1" && exit 1`,
			},
		});

		/** will never happen since above cmd will error out. */
		assert(false);
	} catch (e) {
		return (e as cp.ChildProcess).stdout!.toString().split("\n");
	}
}

export function launchRebaseWithCustomGitRebaseTodoLines(gitRebaseTodoLines: string[], base: string, restArgs: string = ""): void {
	const dotGitDirPath: string = git.getDotGitDirPath();

	const customGitRebaseTodoFilepath: string = path.join(dotGitDirPath, "git-rebase-todo.tmp");
	fs.writeFileSync(customGitRebaseTodoFilepath, gitRebaseTodoLines.join("\n"), { encoding: "utf-8" });

	cp.execSync(`git rebase --interactive ${base} ${restArgs}`, {
		env: {
			GIT_SEQUENCE_EDITOR: `sh -c 'mv "${customGitRebaseTodoFilepath}" "$1"' "$0" "$@"`
		}
	});
}

export function continueRebase() {
	cp.execSync(`git rebase --continue`);
}

export function abortRebase() {
	cp.execSync(`git rebase --abort`);
}

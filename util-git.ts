import path from "path";
import cp from "child_process";
import assert from "assert";

import { cleanLines } from "./util";
import { ModCommitPair, getFileModHistories } from "./file-history";

export function getRepoRootPath(): string {
	return cp.execSync(`git rev-parse --show-toplevel`).toString().trim();
}

export function getDotGitDirPath(): string {
	return path.resolve(cp.execSync(`git rev-parse --git-dir`).toString().trim());
}

export function getHead(): string {
	return cp.execSync(`git rev-parse HEAD`).toString().trim();
}

export function listRepoRelativeFilepaths(cwd: string = getRepoRootPath()): string[] {
	return cp.execSync(`git ls-files`, { cwd })
		.toString()
		.split("\n")
		.filter(x => !!x);
}

export function resolveRepoRelFilepath(pathSuffix: string, repoRelFilepaths: string[], sinceCommittish: string): string {
	const matchingSuffixes: string[] = repoRelFilepaths.filter(x => x.endsWith(pathSuffix));

	if (matchingSuffixes.length === 1) {
		return matchingSuffixes[0];
	} else if (matchingSuffixes.length > 1) {
		/**
		 * TODO allow fixing later
		 */
		const msg = `matched > 1 files for given suffix "${pathSuffix}". provide longer suffix.`;
		throw new Error(msg);
	}

	/**
	 * none found in current state of repo,
	 * thus search in earlier commits.
	 */
	const commits: string[] = listCommitsOfFile(pathSuffix, sinceCommittish);

	if (commits.length) {
		return pathSuffix;
	}

	throw new Error(`did not find file in repo for provided suffix "${pathSuffix}".`);
}

export function listCommitsSince(sinceCommittish: string): string[] {
	return getFileModHistories({ sinceCommittish }).listCommits();
}

export function listCommitsOfFile(file: string, sinceCommittish?: string): string[] {
	return getFileModHistories({ file, sinceCommittish }).listCommitsOfFile();
}

export function listModificationsOfFile(file: string, sinceCommittish?: string): ModCommitPair[] {
	return getFileModHistories({ file, sinceCommittish }).listModificationsOfFile();
}

/**
 * TODO further search & verify,
 * e.g. if git couldn't auto-detect a rename.
 */
export function allCommitsOfFileAreWithinSince(
	filepath: string, //
	sinceCommittish: string,
	commitsOfFileSince: string[] = listCommitsOfFile(filepath, sinceCommittish),
	commitsOfFile: string[] = listCommitsOfFile(filepath),
): boolean {
	if (commitsOfFile.length !== commitsOfFileSince.length) return false;

	for (let i = 0; i < commitsOfFile.length; i++) {
		if (commitsOfFile[i] !== commitsOfFileSince[i]) return false;
	}

	return true;
}

export function ensureRepoStateClean() {
	if (repoHasUntrackedChanges()) {
		const msg = `repo has untracked changes.`;
		throw new Error(msg);
	}
}

export function repoHasUntrackedChanges(): boolean {
	return cp.execSync("git status -s").toString().length > 0;
}

export type FileRename = {
	from: string;
	to: string;
};

export type DidCommitRenameFileRet = false | FileRename;

/**
 * TODO handle complex renames
 */
export function didCommitRenameFile(filepath: string, commit: string): DidCommitRenameFileRet {
	const out = cp.execSync(`git show ${commit} --diff-filter=R --name-status`).toString();

	const renameInfos: string[] = cleanLines(out).filter(x => x.includes(filepath));
	if (!renameInfos.length) return false;

	assert.deepStrictEqual(renameInfos.length, 1);
	const info = renameInfos[0].split(spaceTabManyRegex).filter(x => !!x.trim());

	assert.deepStrictEqual(info.length, 3);
	const [_status, from, to] = info;

	return {
		from,
		to,
	};
}

export const spaceTabManyRegex = /[\s\t]+/g;

export function addGlobalChanges(pathspec: string = ".") {
	cp.execSync(`git add ${pathspec}`, { cwd: getRepoRootPath() });
}

export function amendCommit() {
	cp.execSync(`git commit --amend --no-edit`);
}

export function resetHard(committish: string) {
	cp.execSync(`git reset --hard ${committish}`);
}

import cp from "child_process";
import assert from "assert";

import { spaceTabManyRegex } from "./util-git";
import { uniq } from "./util";

/**
 * man git-log
 *
 * --diff-filter=[(A|C|D|M|R|T|U|X|B)...[*]]
 *     Select only files that are Added (A), Copied (C), Deleted (D),
 *     Modified (M), Renamed (R), have their type (i.e. regular file,
 *     symlink, submodule, ...) changed (T), are Unmerged (U), are Unknown
 *     (X), or have had their pairing Broken (B). Any combination of the
 *     filter characters (including none) can be used. When * (All-or-none)
 *     is added to the combination, all paths are selected if there is any
 *     file that matches other criteria in the comparison; if there is no
 *     file that matches other criteria, nothing is selected.
 */
export type Mod = "A" | "C" | "D" | "M" | "R" | "T" | "U" | "X" | "B";
export type ModCommitPair = [Mod, string];

export const MOD = {
	delete: "D",
	add: "A",
	modify: "M",
	rename: "R",
	copy: "C",
} as const satisfies Record<string, Mod>;

export type FileModificationHistory = [string, ModCommitPair[]];

export type GetFileModHistoriesOpts = {
	sinceCommittish?: string;
	file?: string;
}

export function getFileModHistories(opts: GetFileModHistoriesOpts = {}) {
	/**
	 * TODO - no --follow?
	 *
	 * i think we expect to find the files here,
	 * and the `--delete-files` machinery to handle the renames..
	 *
	 * this is not ideal - we should inform in advance what files
	 * will be affected, including renames.
	 *
	 */
	const cmd: string = [
		`git log --pretty=format:"%H" --name-status`,
		opts.sinceCommittish ? `${opts.sinceCommittish}..` : "",
		opts.file ? `-- ${opts.file}` : "",
	].join(" ");

	const out = cp.execSync(cmd).toString();
	const parts: string[] = out.split("\n\n");

	const file2modsMap: Map<string, ModCommitPair[]> = new Map();
	const rename2LatestFileMap: Map<string, string> = new Map();

	for (const part of parts) {
		const lines = part.split("\n");
		const [commit, ...modsLines] = lines;

		for (const modLine of modsLines) {
			/**
			 * `file` is relative path from repo root
			 */
			let [modRaw, file, ...rest] = modLine.split(spaceTabManyRegex);
			const mod: Mod = modRaw[0] as Mod;

			if (mod === MOD.copy) {
				/**
				 * if we detect a copy, we'll be given history
				 * of a completely unrelated file we copied from.
				 * 
				 * this is especially a problem if a file was added as empty,
				 * and there existed another empty file anywhere in the repo,
				 * because now their histories would be mixed, even though
				 * completely unrelated.
				 * 
				 * `--diff-filter=c` to disable copies does NOT help,
				 * because it only affects the "printing diffs" stage,
				 * which comes *after* the "find relevant commits of a file" stage.
				 */
				break;
			}

			if (mod === MOD.rename) {
				const fileFrom = file;
				const fileTo = rest.shift()!;

				const has = rename2LatestFileMap.has(fileTo);

				const latestFile: string = has
					? rename2LatestFileMap.get(fileTo)!
					: fileTo;

				rename2LatestFileMap.set(fileFrom, latestFile);
			}

			/**
			 * keep all modifications associated with the same file,
			 * even accross renames.
			 */
			if (rename2LatestFileMap.has(file)) {
				file = rename2LatestFileMap.get(file)!;
			}

			assert.deepStrictEqual(rest.length, 0, `unparsed content of modification line detected. modLine = ${modLine}`);

			if (!file2modsMap.has(file)) file2modsMap.set(file, []);
			file2modsMap.get(file)!.push([mod as Mod, commit]);
		}
	}

	function listModificationsOfFile(file: string = opts.file || ""): ModCommitPair[] {
		if (!file2modsMap.has(file)) {
			const msg = `file not found in file2modsMap (file "${file}").`;
			throw new Error(msg);
		}

		const modPairs: ModCommitPair[] = file2modsMap.get(file)!;
		return modPairs;
	}

	function listCommitsOfFile(file: string = opts.file || "", modPairs: ModCommitPair[] = listModificationsOfFile(file)): string[] {
		const commitsOfFile: string[] = modPairs.map(x => x[1]);
		return commitsOfFile;
	}

	/**
	 * TODO VERIFY git-log commit ordering
	 */
	function listCommits(): string[] {
		const commits: string[] = [...file2modsMap].map(([_file, modCommitPairs]) => modCommitPairs.map(([_mod, commit]) => commit)).flat();
		return uniq(commits);
	}

	return {
		file2modsMap,
		rename2LatestFileMap,

		//
		listModificationsOfFile,
		listCommitsOfFile,
		listCommits,
	};
}

// TODO
export function getFileHistoriesSince_spec() {
	"collects history of file across commits"
	"collects history of file across commits, including renames"

	"lists commits, in correct git-log order (reverse chronological) (latest first), for a single file"
	"lists commits, in correct git-log order (reverse chronological) (latest first), for all files, since committish"
}

import cp from "child_process";
import assert from "assert";

import { spaceTabManyRegex } from "./util-git";

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

export function getFileModHistoriesSince(sinceCommittish: string) {
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
	const out = cp.execSync(`git log --pretty=format:"%H" --name-status ${sinceCommittish}..`).toString();
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
			const [modRaw, file, ...rest] = modLine.split(spaceTabManyRegex);
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

			assert.deepStrictEqual(rest.length, 0, `unparsed content of modification line detected. modLine = ${modLine}`);

			if (!file2modsMap.has(file)) file2modsMap.set(file, []);
			file2modsMap.get(file)!.push([mod as Mod, commit]);
		}
	}

	return {
		file2modsMap,
		rename2LatestFileMap,
	};
}

// TODO
export function getFileHistoriesSince_spec() {
	"collects history of file across commits"
	"collects history of file across commits, including renames"
}

import { getFileModHistories, FileModificationHistory, Mod, MOD } from "./file-history";
import { log } from "./util";

export function listDeadFilesSince(sinceCommittish: string): string[] {
	const historyMods = getFileModHistories({ sinceCommittish });
	const fileModHistories: FileModificationHistory[] = [...historyMods.file2modsMap];

	log({ fileModHistories, renames: [...historyMods.rename2LatestFileMap] });

	const deadFiles: string[] = [];

	for (const [file, modPairs] of fileModHistories) {
		const mods: Mod[] = modPairs.map(([mod]) => mod);
		if (isFileDead(mods)) deadFiles.push(file);
	}

	return deadFiles;
}

export function isFileDead(mods: Mod[]): boolean {
	return (mods[0] === MOD.delete && mods[mods.length - 1] === MOD.add)
		&& mods.filter(x => x === MOD.add).length < 2 /** TODO handle partially-dead (if earlier add + delete pairs exist). */;
}

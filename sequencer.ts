import * as git from "./util-git";
import * as rebase from "./util-git-rebase";

export type ReverseSequencerActionCtx = {
	commit: string;
};

export type ReverseSequencerAction = (ctx: ReverseSequencerActionCtx) => void;

export type ReverseSequencerCtx = {
	base: string;
	commits: string[];
	actionOnCommit: ReverseSequencerAction;
};

/**
 * 
 */
export function reverseSequencer({
	commits,
	actionOnCommit,
 }: ReverseSequencerCtx) {
	git.ensureRepoStateClean();

	const headBeforeReverseRebases: string = git.getHead();

	try {
		/**
		 * TODO: assert commits are given in latest-first, oldest-last order,
		 * and within base.
		 */
		for (const commit of commits) {
			const baseWithCommit = commit + "~";

			const rebaseCmds: string[] = rebase.launchFakeRebaseToGetRebaseTodoLines(baseWithCommit);

			/**
			 * stop after 1st commit (our current base).
			 */
			rebaseCmds.splice(1, 0, "break");

			rebase.launchRebaseWithCustomGitRebaseTodoLines(rebaseCmds, baseWithCommit);

			/**
			 * perform the action
			 */

			actionOnCommit({
				commit, //
			});

			/**
			 * finish rebase for current commit.
			 */
			rebase.continueRebase();
		}

		/**
		 * TODO PERF - optimize by disabling slow features of rebase,
		 * e.g. gpgSign,
		 * and perform 1 additional (final) rebase w/ slow features enabled
		 * (enabled, i.e. defaults of what user has configured)
		 * to give user the expected state.
		 */
	} catch (e) {
		/**
		 * an action may contain many files.
		 * for every file, we do a separate rebase *for every commit*
		 * (so as to go in reverse order).
		 * i.e., we perform files * commits_per_file rebases.
		 * 
		 * in case any of the rebases of a file fail,
		 * we should be able to restore to the original state,
		 * so that we don't leave the job of a file partially done,
		 * which is worse than not doing anything at all.
		 *
		 * TODO CONTINUITY - allow choosing what to do if fail
		 * (e.g. skip current file, we'll write succ/fail info anyway).
		 */
		rebase.abortRebase();
		git.resetHard(headBeforeReverseRebases);

		const msg: string = [
			`reverse-sequencer: encountered failure while performing action for file in some commit.`,
			`reverse-sequencer: aborting reverse-rebase for file.`,
		].join("\n") + "\n";
		console.error(msg);

		throw e;
	}
}

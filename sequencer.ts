import { GitReverseRebaseOpts } from "./opts";
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
} & Pick<GitReverseRebaseOpts, "dropEmpty">;

/**
 * 
 */
export function reverseSequencer({
	commits,
	actionOnCommit,
	dropEmpty,
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

			const extraRebaseArgs: string = [
				/**
				 * either keep or drop empty commits,
				 * so that rebase won't be stopped, and `--continue` won't be interrupted.
				 *
				 * note that `--empty=drop` only affects commits that become empty
				 * in the current rebase, NOT commits that were already empty.
				 * for the latter, there's `--no-keep-empty`, see `man git-rebase`.
				 */
				dropEmpty ? "--empty=drop" : "--empty=keep",

				/**
				 * drop the already-empty commits too.
				 * this is needed to simplify logic for our `performOpDeleteFile`,
				 * specific `amendCommit`, where an empty commit can be
				 * created by amending the commit.
				 *
				 * this may cause a problem in the future, if a user already has
				 * some empty commits, and wants to keep them untouched,
				 * while still removing the newly-made empty commits from our rebase.
				 *
				 * to fix this, we should properly handle the `dropEmpty` logic
				 * in `performOpDeleteFile`, instead of allowing empty commits there.
				 */
				dropEmpty ? "--no-keep-empty" : "",
			].filter(x => x).join(" ");

			rebase.launchRebaseWithCustomGitRebaseTodoLines(rebaseCmds, baseWithCommit, extraRebaseArgs);

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

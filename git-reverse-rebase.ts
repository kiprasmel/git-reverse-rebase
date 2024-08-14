#!/usr/bin/env ts-node-dev

import { assertNever, log } from "./util";
import { performOpDeleteFile } from "./operation";
import { GitReverseRebaseOpts, parseArgv, validateOptions } from "./opts";

export function git_reverse_rebase_cli(argv: string[] = process.argv.slice(2)): void {
	const opts = parseArgv(argv);
	log(opts);
	gitReverseRebase(opts);
}

export function gitReverseRebase(opts: GitReverseRebaseOpts): void {
	validateOptions(opts);

	for (const op of opts.operations) {
		if (op.kind === "delete_file") {
			performOpDeleteFile(opts.base, op);
		} else {
			assertNever(op.kind);
		}
	}
}

if (!module.parent) {
	git_reverse_rebase_cli();
}

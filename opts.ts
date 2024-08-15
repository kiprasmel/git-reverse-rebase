import fs from "fs-extra";

import { Operation } from "./operation";
import { cleanLines } from "./util";
import { listDeadFilesSince } from "./dead-files";

export type GitReverseRebaseOpts = {
	/**
	 * onto where the rebase should be performed.
	 */
	base: string;

	operations: Operation[];

	/**
	 * flags
	*/
	continue: boolean;
	abort: boolean;
	listDeadFiles: boolean;
};

export type GitReverseRebaseOption = keyof GitReverseRebaseOpts;

export function parseArgv(argv: string[]): GitReverseRebaseOpts {
	// const peek = () => argv[0];
	const eat = () => argv.shift();
	const has = () => argv.length > 0;
	const ensureHas = (arg: string) => {
		if (!has()) throw new Error(`arg "${arg}" expects a value.`);
	}

	const opts: GitReverseRebaseOpts = {
		base: "",
		operations: [],

		continue: false,
		abort: false,
		listDeadFiles: false,
	};

	const deferUntilParsed: (() => void)[] = [];

	while (has()) {
		const arg = eat();

		switch (arg) {
			case "--df":
			case "--delete-file":
			case "--delete-files": {
				ensureHas(arg);
				const value = eat()!.trim();

				const files: string[] = value === "-"
					? cleanLines(fs.readFileSync(0).toString())
					: value.split(",");

				opts.operations.push({
					kind: "delete_file",
					files,
				});

				break;
			}

			case "--ldf":
			case "--list-dead-files": {
				opts.listDeadFiles = true;
				break;
			}

			case "--ddf":
			case "--delete-dead-files": {
				opts.listDeadFiles = true; // implied

				/**
				 * we depend on the `opts.base` to be parsed,
				 * but it might not be at this point yet.
				 * thus, defer until parsing is done.
				 */
				deferUntilParsed.push(() => {
					const files: string[] = listDeadFilesSince(opts.base);
					opts.operations.push({
						kind: "delete_file",
						files,
					})
				});

				break;
			}

			default: {
				if (!opts.base && !!arg) {
					opts.base = arg;
					break;
				} 

				const msg = `unknown arg "${arg}".`;
				throw new Error(msg);
			}
		}
	}

	validateOptions(opts);

	for (const deferred of deferUntilParsed) {
		deferred();
	}

	validateOptions(opts);

	return opts;
}

export function validateOptions(opts: GitReverseRebaseOpts): asserts opts is GitReverseRebaseOpts {
	if (!opts.base) {
		const msg = `option "base" is required.`;
		throw new Error(msg);
	}

	const incompatibleOptionGroups: GitReverseRebaseOption[][] = [
		["abort", "continue", "listDeadFiles"], //
	];

	for (const group of incompatibleOptionGroups) {
		/**
		 * TODO support not only flags.
		 */
		const enabled = group.filter(x => opts[x]);

		if (enabled.length > 1) {
			const msg = `multiple incompatible flags detected: "${enabled}".`;
			throw new Error(msg);
		}
	}
}

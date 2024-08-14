import { Operation } from "./operation";

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
};

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
	};

	while (has()) {
		const arg = eat();

		switch (arg) {
			case "--df":
			case "--delete-file":
			case "--delete-files": {
				ensureHas(arg);
				const value = eat()!;

				opts.operations.push({
					kind: "delete_file",
					files: value.split(","),
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

	return opts;
}

export function validateOptions(opts: GitReverseRebaseOpts): asserts opts is GitReverseRebaseOpts {
	if (!opts.base) {
		const msg = `option "base" is required.`;
		throw new Error(msg);
	}
}
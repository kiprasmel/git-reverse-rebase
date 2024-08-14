export function assertNever(x: never): never {
	throw new Error(`expected type to be "never", got ${x}`);
}

export function cleanLines(lines: string): string[] {
	return lines.split("\n")
		.map(x => x.trim())
		.filter(x => !!x);
}

export function log(obj: any): void {
	if (process.env.DEBUG) {
		console.dir(obj, { depth: null });
	}
}

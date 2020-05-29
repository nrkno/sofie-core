declare module 'safer-eval' {
	interface Options {
		filename: string
	}
	class SaferEval {
		constructor(context: any, opts: Options)
		runInContext(...args: any[]): any
	}
}

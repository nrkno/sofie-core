/**
 * requestIdleCallback is an Editor's draft as of 19 August 2020: https://w3c.github.io/requestidlecallback/
 */

if (typeof window.requestIdleCallback !== 'function') {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	window.requestIdleCallback = (clb: Function) => {
		return window.requestAnimationFrame(clb as any)
	}

	window.cancelIdleCallback = (callback: number) => {
		window.cancelAnimationFrame(callback)
	}
}

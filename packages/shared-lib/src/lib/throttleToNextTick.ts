/**
 * Wraps a function so that consecutive calls are throttled until the next tick
 * @param callback the callback to wrap
 * @returns wrapped callback
 */
export default function throttleToNextTick(fn: () => void): () => void {
	let scheduled = false

	return (): void => {
		if (!scheduled) {
			scheduled = true
			process.nextTick(() => {
				fn()
				scheduled = false
			})
		}
	}
}

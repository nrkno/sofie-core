export type Options = {
	/** If true, newly added jobs will automatically start. If false, .start() needs to be called for the queue to start executing. (Defaults to true) */
	autoStart: boolean
	executionWrapper?: WrapperFunction<any>
	resolutionWrapper?: DeferFunction
}
export type WrapperFunction<T> = (fnc: () => T) => () => T
export type DeferFunction = (fnc: () => void) => void

export type AsyncFunction = () => Promise<void>
export type JobOptions = {
	/** (Optional) The className is used to categorize jobs, so that they can be removed by .remove(className) */
	className?: string
}

/**
 * A simple Job-queue runner with the added benefit of being able to set a `className` to a job.
 * By calling .remove(className) all jobs with a certain className is discarded from the queue.
 */
export class JobQueueWithClasses {
	#queue: JobDescription[] = []
	#autoStart: boolean
	#paused = true
	#executionWrapper?: WrapperFunction<any>
	#resolutionWrapper?: DeferFunction

	constructor(opts?: Options) {
		this.#autoStart = opts?.autoStart ?? true
		this.#executionWrapper = opts?.executionWrapper
		this.#resolutionWrapper = opts?.resolutionWrapper
	}

	/**
	 * Add a job to the queue.
	 */
	async add(fn: AsyncFunction, options?: JobOptions): Promise<void> {
		return new Promise((resolve, reject) => {
			const handlePromise = (p: Promise<void>, resolve: () => void, reject: (err: any) => void) => {
				if (this.#resolutionWrapper) {
					const wrapper = this.#resolutionWrapper
					p.then(() => {
						wrapper(() => resolve())
					}).catch((err) => {
						wrapper(() => reject(err))
					})
				} else {
					p.then(resolve).catch(reject)
				}
			}

			let wrappedFn: () => Promise<void>
			if (this.#executionWrapper) {
				wrappedFn = this.#executionWrapper(async () => {
					return new Promise<void>((resolve, reject) => {
						handlePromise(fn(), resolve, reject)
					})
				})
			} else {
				wrappedFn = async () => {
					new Promise<void>((resolve, reject) => {
						handlePromise(fn(), resolve, reject)
					}).catch(reject)
				}
			}

			this.#queue.push({
				className: options?.className,
				fn: wrappedFn,
				resolve,
				reject,
			})
			if (this.#autoStart && this.#paused) this.start()
		})
	}
	/** Clear queue */
	clear(): void {
		this.#queue.length = 0
	}
	/** Remove all jobs with a certain className */
	remove(className?: string): void {
		this.#queue = this.#queue.filter((job) => job.className !== className)
	}

	/** Start executing the queue */
	start(): void {
		if (this.#paused === false) return
		;(async () => {
			this.#paused = false
			// eslint-disable-next-line no-constant-condition
			while (true) {
				const firstIn = this.#queue.shift()
				if (!firstIn) break
				try {
					await firstIn.fn()
					firstIn.resolve()
				} catch (error) {
					firstIn.reject(error)
				}
			}
			this.#paused = true
		})().catch((error) => {
			console.error(error)
		})
	}
}

interface JobDescription {
	fn: AsyncFunction
	className?: string
	resolve: () => void
	reject: (error?: any) => void
}

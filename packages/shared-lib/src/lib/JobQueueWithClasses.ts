type AsyncFunction = () => Promise<void>

interface JobDescription {
	className?: string
	resolve: () => void
	reject: (error?: any) => void
	fn: AsyncFunction
}

type AddOptions = {
	className?: string
}

type WrapperFunction<T> = (fnc: () => T) => () => T
type DeferFunction = (fnc: () => void) => void

type Options = {
	autoStart: boolean
	executionWrapper?: WrapperFunction<any>
	resolutionWrapper?: DeferFunction
}

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

	async add(fn: AsyncFunction, options?: AddOptions): Promise<void> {
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

	clear(): void {
		this.#queue.length = 0
	}

	remove(className?: string): void {
		this.#queue = this.#queue.filter((job) => job.className !== className)
	}

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

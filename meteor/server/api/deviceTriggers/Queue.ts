import { Meteor } from 'meteor/meteor'

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

type Options = {
	autoStart: boolean
}

export class PromiseQueue {
	#queue: JobDescription[] = []
	#autoStart: boolean
	#paused = true

	constructor(opts?: Options) {
		this.#autoStart = opts?.autoStart ?? true
	}

	async add(fn: AsyncFunction, options?: AddOptions): Promise<void> {
		return new Promise((resolve, reject) => {
			const wrappedFn = Meteor.bindEnvironment(async () => {
				return new Promise<void>((resolve, reject) => {
					fn()
						.then(() => {
							Meteor.defer(() => resolve())
						})
						.catch((err) => {
							Meteor.defer(() => reject(err))
						})
				})
			})

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

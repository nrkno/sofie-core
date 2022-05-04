// Make sure not to run next function until previous function has resolved (or rejected)
type Fcn<T> = {
	reject: (err: any) => void
	resolve: (res: T) => void
	fcn: () => Promise<T>
}
export class Queue {
	private _isRunning = false
	private _queue: Fcn<any>[] = []
	async putOnQueue<T>(fcn: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this._queue.push({
				fcn,
				resolve,
				reject,
			})
			setTimeout(() => {
				this.checkQueue()
			}, 0)
		})
	}
	private checkQueue() {
		if (!this._isRunning) {
			const nextOnQueue = this._queue.shift()
			if (nextOnQueue) {
				this._isRunning = true

				try {
					nextOnQueue.fcn().then(
						(result) => {
							nextOnQueue.resolve(result)
							this._isRunning = false
							this.checkQueue()
						},
						(error) => {
							nextOnQueue.reject(error)
							this._isRunning = false
							this.checkQueue()
						}
					)
				} catch (error) {
					nextOnQueue.reject(error)
					this._isRunning = false
					this.checkQueue()
				}
			}
		}
	}
}

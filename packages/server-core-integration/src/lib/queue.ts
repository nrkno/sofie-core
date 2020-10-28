// Make sure not to run next function until previous function has resolved (or rejected)
type Fcn = {
	reject: Function
	resolve: Function
	fcn: () => Promise<any>
}
export class Queue {
	private _isRunning: boolean = false
	private _queue: Fcn[] = []
	putOnQueue<T> (fcn: () => Promise<T>): Promise<T> {

		const p = new Promise<T>((resolve, reject) => {
			this._queue.push({
				fcn, resolve, reject
			})
			setTimeout(() => {
				this.checkQueue()
			}, 0)
		})

		return p
	}
	private checkQueue () {
		if (!this._isRunning) {

			const nextOnQueue = this._queue.shift()
			if (nextOnQueue) {

				this._isRunning = true

				try {
					nextOnQueue.fcn()
					.then((result) => {
						nextOnQueue.resolve(result)
						this._isRunning = false
						this.checkQueue()
					}, (error) => {
						nextOnQueue.reject(error)
						this._isRunning = false
						this.checkQueue()
					})
				} catch (error) {
					nextOnQueue.reject(error)
					this._isRunning = false
					this.checkQueue()
				}

			}
		}
	}
}

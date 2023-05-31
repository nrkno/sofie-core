export class CorePinger {
	private _pingTimeout: NodeJS.Timer | null = null
	private _connected = false

	constructor(private readonly emitError: (err: string) => void, private readonly doPing: () => Promise<void>) {}

	public setConnected(connected: boolean): void {
		this._connected = connected
	}

	public destroy(): void {
		if (this._pingTimeout) {
			clearTimeout(this._pingTimeout)
			this._pingTimeout = null
		}
	}

	public triggerPing(): void {
		if (!this._pingTimeout) {
			this._pingTimeout = setTimeout(() => {
				this._pingTimeout = null
				this._ping()
			}, 90 * 1000)
		}
	}
	public triggerDelayPing(): void {
		// delay the ping:
		if (this._pingTimeout) {
			clearTimeout(this._pingTimeout)
			this._pingTimeout = null
		}
		this.triggerPing()
	}
	private _ping() {
		try {
			if (this._connected) {
				this.doPing().catch((e) => this.emitError('_ping' + e))
			}
		} catch (e) {
			this.emitError('_ping2 ' + e)
		}
		if (this._connected) {
			this.triggerPing()
		}
	}
}

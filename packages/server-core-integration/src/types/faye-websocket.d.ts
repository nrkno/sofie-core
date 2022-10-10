declare module 'faye-websocket' {
	export interface MessageEvent {
		data: any
	}

	export interface CloseEvent {
		code: number
		reason: string
		wasClean: boolean
	}

	export class Client {
		constructor(url: string, protcols?: Array<string> | null, options?: { [name: string]: unknown })
		send(data: string): void
		close(code?: number, reason?: string): void

		on(event: 'open', cb: () => void): void
		on(event: 'message', cb: (msg: MessageEvent) => void): void
		on(event: 'close', cb: (event: CloseEvent) => void): void
		on(event: 'error', cb: (error: Error) => void): void
	}
}

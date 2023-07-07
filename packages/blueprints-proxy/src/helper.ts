/**
 * Signature for the handler functions
 */
type HandlerFunction<T extends (...args: any) => any> = (
	functionId: string,
	...args: Parameters<T>
) => Promise<ReturnType<T>>

type HandlerFunctionOrNever<T> = T extends (...args: any) => any ? HandlerFunction<T> : never

/** Map of handler functions */
export type EventHandlers<T extends object> = {
	[K in keyof T]: HandlerFunctionOrNever<T[K]>
}

export type ResultCallback<T> = (err: any, res: T) => void

/** Subscribe to all the events defined in the handlers, and wrap with safety and logging */
export function listenToEvents<T extends object>(socket: any, handlers: EventHandlers<T>): void {
	// const logger = createChildLogger(`module/${connectionId}`);

	for (const [event, handler] of Object.entries(handlers)) {
		socket.on(event as any, async (functionId: string, msg: any, cb: ResultCallback<any>) => {
			// TODO - find/reject callback?

			if (!functionId || typeof functionId !== 'string') {
				console.warn(`Received malformed functionId "${event}"`)
				return // Ignore messages without correct structure
			}
			if (!msg || typeof msg !== 'object') {
				console.warn(`Received malformed message object "${event}"`)
				return // Ignore messages without correct structure
			}
			if (cb && typeof cb !== 'function') {
				console.warn(`Received malformed callback "${event}"`)
				return // Ignore messages without correct structure
			}

			try {
				// Run it
				const handler2 = handler as HandlerFunction<(msg: any) => any>
				const result = await handler2(functionId, msg)

				if (cb) cb(null, result)
			} catch (e: any) {
				console.error(`Command failed: ${e}`, e.stack)
				if (cb) cb(e?.toString() ?? JSON.stringify(e), undefined)
			}
		})
	}
}

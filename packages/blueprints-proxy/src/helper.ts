/**
 * Signature for the handler functions
 */
type HandlerReturnType<T extends (...args: any) => any> = ReturnType<T> extends never ? void : Promise<ReturnType<T>>
type HandlerFunction<T extends (...args: any) => any> = (
	invocationId: string,
	...args: Parameters<T>
) => HandlerReturnType<T>

type HandlerFunctionOrNever<T> = T extends (...args: any) => any ? HandlerFunction<T> : never

/** Map of handler functions */
export type EventHandlers<T extends object> = {
	[K in keyof T]: HandlerFunctionOrNever<T[K]>
}

export type ResultCallback<T> = (err: any, res: T) => void

export type ParamsIfReturnIsValid<T extends (...args: any[]) => any> = ReturnType<T> extends never
	? never
	: Parameters<T>

export type ParamsIfReturnIsNever<T extends (...args: any[]) => any> = ReturnType<T> extends never
	? Parameters<T>
	: never

/** Subscribe to all the events defined in the handlers, and wrap with safety and logging */
export function listenToEvents<T extends object>(socket: any, handlers: EventHandlers<T>): void {
	// const logger = createChildLogger(`module/${connectionId}`);

	for (const [event, handler] of Object.entries(handlers)) {
		socket.on(event as any, async (invocationId: string, msg: any, cb: ResultCallback<any>) => {
			const doError = (msg: string) => {
				console.warn(msg)
				if (cb && typeof cb === 'function') {
					cb(msg, null)
				} else {
					socket.close()
				}
			}
			// TODO - find/reject callback?

			console.log('running', event, invocationId, JSON.stringify(msg))

			if (!invocationId || typeof invocationId !== 'string') {
				doError(`Received malformed invocationId "${event}"`)
				return // Ignore messages without correct structure
			}
			if (!msg || typeof msg !== 'object') {
				doError(`Received malformed message object "${event}"`)
				return // Ignore messages without correct structure
			}
			if (cb && typeof cb !== 'function') {
				doError(`Received malformed callback "${event}"`)
				return // Ignore messages without correct structure
			}

			try {
				// Run it
				const handler2 = handler as HandlerFunction<(msg: any) => any>
				const result = await handler2(invocationId, msg)

				if (cb) cb(null, result)
			} catch (e: any) {
				console.error(`Command failed: ${e}`, e.stack)
				if (cb) cb(e?.toString() ?? JSON.stringify(e), undefined)
				else socket.close()
			}
		})
	}
}

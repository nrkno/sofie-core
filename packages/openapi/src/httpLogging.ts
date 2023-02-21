// eslint-disable-next-line node/no-missing-import
import { Middleware, ResponseContext, ErrorContext, RequestContext, FetchParams } from '../client/ts'

class TestError extends Error {
	override name: 'TestError' = 'TestError' as const
	constructor(msg: string) {
		super(msg)
	}
}

export default class Logging implements Middleware {
	async pre(context: RequestContext): Promise<void | FetchParams> {
		console.log(`Request ${context.url} - ${JSON.stringify(context.init).replace(/"/g, '')}`)
	}

	async onError(context: ErrorContext): Promise<void | Response> {
		throw new TestError(context.error as string)
	}

	async post(context: ResponseContext): Promise<void | Response> {
		await this._logResponse(context.response)
	}

	async _logResponse(response: Response): Promise<void> {
		let message: string
		try {
			message = JSON.stringify(await response.json(), null, 2)
		} catch (e) {
			//eslint-disable-next-line no-empty
		}
		console.log(`Response ${response.url} ${response.status} ${response.statusText} - ${message}`)
	}
}

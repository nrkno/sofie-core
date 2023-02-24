// eslint-disable-next-line node/no-missing-import
import { Middleware, ResponseContext, ErrorContext, RequestContext, FetchParams } from '../client/ts'

class TestError extends Error {
	override name: 'TestError' = 'TestError' as const
	constructor(msg: string) {
		super(msg)
	}
}

export default class Logging implements Middleware {
	_logging: boolean
	constructor(logging?: boolean) {
		this._logging = logging || false
	}

	async pre(context: RequestContext): Promise<void | FetchParams> {
		if (this._logging) console.log(`Request ${context.url} - ${JSON.stringify(context.init).replace(/"/g, '')}`)
	}

	async onError(context: ErrorContext): Promise<void | Response> {
		console.log('Test error:', context.error as string)
		throw new TestError(context.error as string)
	}

	async post(context: ResponseContext): Promise<void | Response> {
		if (context.response && !(context.response.status >= 200 && context.response.status < 300)) {
			console.log(
				`Error Response ${context.response.url} ${context.response.status} ${context.response.statusText}`
			)
			// Return a response with a status of 200 to avoid a throw in the auto-generated client
			return new Response(
				JSON.stringify({ success: context.response.status, message: context.response.statusText }),
				{ headers: context.response.headers, status: 200, statusText: context.response.statusText }
			)
		}
		await this._logResponse(context.response)
	}

	async _logResponse(response: Response): Promise<void> {
		let message: string
		try {
			message = JSON.stringify(await response.json(), null, 2)
		} catch (e) {
			console.log('Response not JSON!')
		}
		if (this._logging)
			console.log(`Response ${response.url} ${response.status} ${response.statusText} - ${message}`)
	}
}

import * as _ from 'underscore'
import { Fiber, runInFiber } from './Fibers'

let controllableDefer: boolean = false

export function useControllableDefer() {
	controllableDefer = true
}
export function useNextTickDefer() {
	controllableDefer = false
}

namespace Meteor {
	export interface Settings {
		public: {
			[id: string]: any
		}
		[id: string]: any
	}

	export interface UserEmail {
		address: string
		verified: boolean
	}
	export interface User {
		_id?: string
		username?: string
		emails?: UserEmail[]
		createdAt?: number
		profile?: any
		services?: any
	}

	export interface ErrorStatic {
		new (error: string | number, reason?: string, details?: string): Error
	}
	export interface Error {
		error: string | number
		reason?: string
		details?: string
	}

	export interface SubscriptionHandle {
		stop(): void
		ready(): boolean
	}
	export interface LiveQueryHandle {
		stop(): void
	}
}
const orgSetTimeout = setTimeout
const orgSetInterval = setInterval
const orgClearTimeout = clearTimeout
const orgClearInterval = clearInterval

const $ = {
	Error,
	get setTimeout(): Function {
		return setTimeout
	},
	get setInterval(): Function {
		return setInterval
	},
	get clearTimeout(): Function {
		return clearTimeout
	},
	get clearInterval(): Function {
		return clearInterval
	},

	get orgSetTimeout(): Function {
		return orgSetTimeout
	},
	get orgSetInterval(): Function {
		return orgSetInterval
	},
	get orgClearTimeout(): Function {
		return orgClearTimeout
	},
	get orgClearInterval(): Function {
		return orgClearInterval
	},
}

export namespace MeteorMock {
	export let isTest: boolean = true

	export let isClient: boolean = false
	export let isCordova: boolean = false
	export let isServer: boolean = true
	export let isProduction: boolean = false
	export let release: string = ''

	export let settings: any = {}

	export let mockMethods: { [name: string]: Function } = {}
	export let mockUser: Meteor.User | undefined = undefined
	export let mockStartupFunctions: Function[] = []

	export let absolutePath = process.cwd()

	export function user(): Meteor.User | undefined {
		return mockUser
	}
	export function userId(): string | undefined {
		return mockUser ? mockUser._id : undefined
	}
	function getMethodContext() {
		return {
			userId: mockUser ? mockUser._id : undefined,
			connection: {
				clientAddress: '1.1.1.1',
			},
		}
	}
	export class Error {
		private _stack?: string
		constructor(public error: number, public reason?: string) {
			const e = new $.Error('')
			let stack: string = e.stack || ''

			const lines = stack.split('\n')
			if (lines.length > 1) {
				lines.shift()
				stack = lines.join('\n')
			}
			this._stack = stack
			// console.log(this._stack)
		}
		get name() {
			return this.toString()
		}
		get message() {
			return this.toString()
		}
		get details() {
			return undefined
		}
		get errorType() {
			return 'Meteor.Error'
		}
		get isClientSafe() {
			return false
		}
		get stack() {
			return this._stack
		}
		toString() {
			return `[${this.error}] ${this.reason}` // TODO: This should be changed to "${this.reason} [${this.error}]"
		}
	}
	export function methods(methods: { [name: string]: Function }) {
		Object.assign(mockMethods, methods)
	}
	export function call(methodName: string, ...args: any[]) {
		const fcn: Function = mockMethods[methodName]
		if (!fcn) {
			console.log(methodName)
			console.log(mockMethods)
			console.log(new Error(1).stack)
			throw new Error(404, `Method '${methodName}' not found`)
		}

		const lastArg = args.length > 0 && args[args.length - 1]
		if (lastArg && typeof lastArg === 'function') {
			const callback = args.pop()

			this.defer(() => {
				try {
					const result = fcn.call(getMethodContext(), ...args)
					Promise.resolve(result)
						.then((result) => {
							callback(undefined, result)
						})
						.catch((e) => {
							callback(e)
						})
				} catch (e) {
					callback(e)
				}
			})
		} else {
			return waitForPromise(Promise.resolve(fcn.call(getMethodContext(), ...args)))
		}
	}
	export function apply(
		methodName: string,
		args: any[],
		options?: {
			wait?: boolean
			onResultReceived?: Function
			returnStubValue?: boolean
			throwStubExceptions?: boolean
		},
		asyncCallback?: Function
	): any {
		// ?
		mockMethods[methodName].call(getMethodContext(), ...args)
	}
	export function absoluteUrl(path?: string): string {
		return path + '' // todo
	}
	export function setTimeout(fcn: Function, time: number): number {
		return ($.setTimeout(() => {
			runInFiber(fcn).catch(console.error)
		}, time) as any) as number
	}
	export function clearTimeout(timer: number) {
		$.clearTimeout(timer)
	}
	export function setInterval(fcn: Function, time: number): number {
		return ($.setInterval(() => {
			runInFiber(fcn).catch(console.error)
		}, time) as any) as number
	}
	export function clearInterval(timer: number) {
		$.clearInterval(timer)
	}
	export function defer(fcn: Function) {
		return (controllableDefer ? $.setTimeout : $.orgSetTimeout)(() => {
			runInFiber(fcn).catch(console.error)
		}, 0)
	}

	export function startup(fcn: Function): void {
		mockStartupFunctions.push(fcn)
	}

	export function wrapAsync(fcn: Function, context?: Object): any {
		return (...args: any[]) => {
			const fiber = Fiber.current
			if (!fiber) throw new Error(500, `It appears that wrapAsync isn't running in a fiber`)

			const callback = (err, value) => {
				if (err) {
					fiber.throwInto(err)
				} else {
					fiber.run(value)
				}
			}
			fcn.apply(context, [...args, callback])

			const returnValue = Fiber.yield()
			return returnValue
		}
	}

	export function bindEnvironment(fcn: Function): any {
		return (...args: any[]) => {
			// Don't know how to implement in mock?

			const fiber = Fiber.current
			if (!fiber) throw new Error(500, `It appears that bindEnvironment function isn't running in a fiber`)

			const returnValue = fcn()

			return returnValue
		}
	}
	export let users: any = undefined

	// export let users = new Mongo.Collection('Meteor.users')
	// export const users = {}
	/*
	export function subscribe () {

	}
	*/
	// -- Mock functions: --------------------------
	/**
	 * Run the Meteor.startup() functions
	 */
	export function mockRunMeteorStartup() {
		_.each(mockStartupFunctions, (fcn) => {
			fcn()
		})

		waitTimeNoFakeTimers(10) // So that any observers or defers has had time to run.
	}
	export function mockLoginUser(user: Meteor.User) {
		mockUser = user
	}
	export function mockSetUsersCollection(usersCollection) {
		users = usersCollection
	}

	// locally defined function here, so there are no import to the rest of the code
	const waitForPromise: <T>(p: Promise<T>) => T = wrapAsync(function waitForPromises<T>(
		p: Promise<T>,
		cb: (err: any | null, result?: any) => T
	) {
		Promise.resolve(p)
			.then((result) => {
				cb(null, result)
			})
			.catch((e) => {
				cb(e)
			})
	})
}
export function setup() {
	return {
		Meteor: MeteorMock,
	}
}

/** Wait for time to pass ( unaffected by jest.useFakeTimers() ) */
export function waitTimeNoFakeTimers(time: number) {
	waitForPromise(new Promise((resolve) => $.orgSetTimeout(resolve, time)))
}
export const waitForPromise: <T>(p: Promise<T>) => T = MeteorMock.wrapAsync(function waitForPromises<T>(
	p: Promise<T>,
	cb: (err: any | null, result?: any) => T
) {
	if (MeteorMock.isClient) throw new MeteorMock.Error(500, `waitForPromise can't be used client-side`)
	Promise.resolve(p)
		.then((result) => {
			cb(null, result)
		})
		.catch((e) => {
			cb(e)
		})
})

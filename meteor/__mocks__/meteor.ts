import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import * as _ from 'underscore'
import { Fiber } from './Fibers'
import { MongoMock } from './mongo'

let controllableDefer = false

export function useControllableDefer(): void {
	controllableDefer = true
}
export function useNextTickDefer(): void {
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

let mockIsClient = false
const publications: Record<string, Function> = {}
export class MeteorMock {
	static get isClient(): boolean {
		return mockIsClient
	}
	static get isServer(): boolean {
		return !MeteorMock.isClient
	}
}

export namespace MeteorMock {
	export const isTest = true

	export const isCordova = false

	export const isProduction = false
	export const release = ''

	export const settings: any = {}

	export const mockMethods: { [name: string]: Function } = {}
	export let mockUser: Meteor.User | undefined = undefined
	export const mockStartupFunctions: Function[] = []

	export const absolutePath = process.cwd()

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
			unblock: () => {
				// noop
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
		get name(): string {
			return this.toString()
		}
		get message(): string {
			return this.toString()
		}
		get details(): any {
			return undefined
		}
		get errorType(): string {
			return 'Meteor.Error'
		}
		get isClientSafe(): boolean {
			return false
		}
		get stack(): string | undefined {
			return this._stack
		}
		toString(): string {
			return `[${this.error}] ${this.reason}` // TODO: This should be changed to "${this.reason} [${this.error}]"
		}
	}
	export function methods(addMethods: { [name: string]: Function }): void {
		Object.assign(mockMethods, addMethods)
	}
	export function call(methodName: string, ...args: any[]): any {
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

			defer(() => {
				try {
					Promise.resolve(fcn.call(getMethodContext(), ...args))
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
			return waitForPromiseLocal(Promise.resolve(fcn.call(getMethodContext(), ...args)))
		}
	}
	export function apply(
		methodName: string,
		args: any[],
		_options?: {
			wait?: boolean
			onResultReceived?: Function
			returnStubValue?: boolean
			throwStubExceptions?: boolean
		},
		asyncCallback?: Function
	): any {
		// ?
		// This is a bad mock, since it doesn't support any of the options..
		// but it'll do for now:
		call(methodName, ...args, asyncCallback)
	}
	export function absoluteUrl(path?: string): string {
		return path + '' // todo
	}
	export function setTimeout(fcn: () => void | Promise<void>, time: number): number {
		return $.setTimeout(() => {
			runInFiber(fcn).catch(console.error)
		}, time) as number
	}
	export function clearTimeout(timer: number): void {
		$.clearTimeout(timer)
	}
	export function setInterval(fcn: () => void | Promise<void>, time: number): number {
		return $.setInterval(() => {
			runInFiber(fcn).catch(console.error)
		}, time) as number
	}
	export function clearInterval(timer: number): void {
		$.clearInterval(timer)
	}
	export function defer(fcn: () => void | Promise<void>): void {
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

			const callback = (err: any, value: any) => {
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

	export function publish(publicationName: string, handler: Function): any {
		publications[publicationName] = handler
	}

	export function bindEnvironment(fcn: Function): any {
		{
			// the outer bindEnvironment must be called from a fiber
			const fiber = Fiber.current
			if (!fiber) throw new Error(500, `It appears that bindEnvironment isn't running in a fiber`)
		}

		return (...args: any[]) => {
			const fiber = Fiber.current
			if (fiber) {
				return fcn(...args)
			} else {
				return runInFiber(() => fcn(...args)).catch(console.error)
			}
		}
	}
	export let users: MongoMock.Collection<any> | undefined = undefined

	// -- Mock functions: --------------------------
	/**
	 * Run the Meteor.startup() functions
	 */
	export function mockRunMeteorStartup(): void {
		_.each(mockStartupFunctions, (fcn) => {
			fcn()
		})

		waitTimeNoFakeTimers(10) // So that any observers or defers has had time to run.
	}
	export function mockLoginUser(newUser: Meteor.User): void {
		mockUser = newUser
	}
	export function mockSetUsersCollection(usersCollection: MongoMock.Collection<any>): void {
		users = usersCollection
	}
	export function mockSetClientEnvironment(): void {
		mockIsClient = true
	}
	export function mockSetServerEnvironment(): void {
		mockIsClient = false
	}
	export function mockGetPublications(): Record<string, Function> {
		return publications
	}

	// locally defined function here, so there are no import to the rest of the code
	const waitForPromiseLocal: <T>(p: Promise<T>) => T = wrapAsync(function waitForPromises<T>(
		p: Promise<T>,
		cb: (err: any | null, result?: any) => T
	) {
		if (cb === undefined && typeof p === 'function') {
			cb = p as any
			p = undefined as any
		}

		Promise.resolve(p)
			.then((result) => {
				cb(null, result)
			})
			.catch((e) => {
				cb(e)
			})
	})

	/** Wait for time to pass ( unaffected by jest.useFakeTimers() ) */
	export async function sleepNoFakeTimers(time: number): Promise<void> {
		return new Promise<void>((resolve) => $.orgSetTimeout(resolve, time))
	}
}
export function setup(): any {
	return {
		Meteor: MeteorMock,
	}
}

/** Wait for time to pass ( unaffected by jest.useFakeTimers() ) */
export function waitTimeNoFakeTimers(time: number): void {
	waitForPromise(MeteorMock.sleepNoFakeTimers(time))
}
export const waitForPromise: <T>(p: Promise<T>) => T = MeteorMock.wrapAsync(function waitForPromises<T>(
	p: Promise<T>,
	cb: (err: any | null, result?: any) => T
) {
	if (MeteorMock.isClient) throw new MeteorMock.Error(500, `waitForPromise can't be used client-side`)
	if (cb === undefined && typeof p === 'function') {
		cb = p as any
		p = undefined as any
	}

	Promise.resolve(p)
		.then((result) => {
			cb(null, result)
		})
		.catch((e) => {
			cb(e)
		})
})

export async function runInFiber<T>(fcn: () => T | Promise<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		Fiber(() => {
			try {
				// Run the function
				const out = fcn()
				if (out instanceof Promise) {
					out.then(resolve).catch((e) => {
						console.log('Error: ' + e)
						reject(e)
					})
				} else {
					// the function has finished
					resolve(out)
				}
			} catch (e: any) {
				// Note: we cannot use
				console.log('Error: ' + stringifyError(e))
				reject(e)
			}
		}).run()
	})
}

import * as _ from 'underscore'
import { Fiber, runInFiber } from './Fibers'

namespace Meteor {

	export interface Settings {
		public: {
			[id: string]: any
		}, [id: string]: any
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
		stop (): void
		ready (): boolean
	}
	export interface LiveQueryHandle {
		stop (): void
	}
}
const $ = {
	Error,
	get setTimeout () { return setTimeout },
	get setInterval () { return setInterval },
	get clearTimeout () { return clearTimeout },
	get clearInterval () { return clearInterval },
}

const mockThis = {
	userId: 1,
	connection: {
		clientAddress: '1.1.1.1'
	}
}

export namespace MeteorMock {

	export let isClient: boolean = false
	export let isCordova: boolean = false
	export let isServer: boolean = true
	export let isProduction: boolean = false
	export let release: string = ''

	export let settings: any = {}

	export let mockMethods: {[name: string]: Function} = {}
	export let mockUser: Meteor.User | undefined = undefined
	export let mockStartupFunctions: Function[] = []

	export let absolutePath = process.cwd()

	export function user (): Meteor.User | undefined {
		return mockUser
	}
	export function userId (): string | undefined {
		return mockUser ? mockUser._id : undefined
	}
	export class Error {
		private _stack?: string
		constructor (public errorCode: number, public reason?: string) {
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
		get name () {
			return this.toString()
		}
		get message () {
			return this.toString()
		}
		get stack () {
			return this._stack
		}
		toString () {
			return `[${this.errorCode}] ${this.reason}`
		}
	}
	export function methods (methods: {[name: string]: Function}) {
		Object.assign(mockMethods, methods)
	}
	export function call (methodName: string, ...args: any[]) {

		const fcn: Function = mockMethods[methodName]
		if (!fcn) {
			console.log(methodName)
			console.log(mockMethods)
			console.log((new Error(1)).stack)
			throw new Error(404, `Method '${methodName}' not found`)
		}

		const lastArg = args.length > 0 && args[args.length - 1]
		if (lastArg && typeof lastArg === 'function') {
			const callback = args.pop()

			this.setTimeout(() => {
				try {
					callback(undefined, fcn.call(mockThis, ...args))
				} catch (e) {
					callback(e)
				}
			}, 0)
		} else {
			return fcn.call(mockThis, ...args)
		}

	}
	export function apply (methodName: string, args: any[], options?: {
		wait?: boolean;
		onResultReceived?: Function;
		returnStubValue?: boolean;
		throwStubExceptions?: boolean;
	}, asyncCallback?: Function): any {
		// ?
		mockMethods[methodName].call(mockThis, ...args)
	}
	export function absoluteUrl (path?: string): string {
		return path + '' // todo
	}
	export function setTimeout (fcn: Function, time: number): number {

		return $.setTimeout(() => {
			runInFiber(fcn).catch(console.error)
		}, time) as any as number
	}
	export function clearTimeout (timer: number) {
		$.clearTimeout(timer)
	}
	export function setInterval (fcn: Function, time: number): number {
		return $.setInterval(() => {
			runInFiber(fcn).catch(console.error)
		}, time) as any as number
	}
	export function clearInterval (timer: number) {
		$.clearInterval(timer)
	}
	export function defer (fcn: Function) {
		return this.setTimeout(fcn, 0)
	}

	export function startup (fcn: Function): void {
		mockStartupFunctions.push(fcn)
	}

	export function wrapAsync (fcn: Function, context?: Object): any {
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

	export function bindEnvironment (fcn: Function): any {
		return (...args: any[]) => {

			// Don't know how to implement in mock?

			const fiber = Fiber.current
			if (!fiber) throw new Error(500, `It appears that bindEnvironment function isn't running in a fiber`)

			const returnValue = fcn()

			return returnValue
		}
		return fcn
	}
	/*
	export function subscribe () {

	}
	*/
	// -- Mock functions: --------------------------
	/**
	 * Run the Meteor.startup() functions
	 */
	export function mockRunMeteorStartup () {
		console.log('>>>', _)
		_.each(mockStartupFunctions, fcn => {
			fcn()
		})
	}
}
export function setup () {
	return {
		Meteor: MeteorMock
	}
}

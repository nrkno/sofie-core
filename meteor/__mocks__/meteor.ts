import _ from 'underscore'
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
	setTimeout,
	setInterval,
	clearTimeout,
	clearInterval,
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

	export function user (): Meteor.User | undefined {
		return this.mockUser
	}
	export function userId (): string | undefined {
		return this.mockUser ? this.mockUser._id : undefined
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
		Object.assign(this.mockMethods, methods)
	}
	export function call (methodName: string, ...args: any[]) {
		const fcn: Function = this.mockMethods[methodName]
		if (!fcn) {
			throw new Error(404, `Method '${methodName}' not found`)
		}

		fcn.call({}, ...args)
	}
	export function apply (methodName: string, args: any[], options?: {
		wait?: boolean;
		onResultReceived?: Function;
		returnStubValue?: boolean;
		throwStubExceptions?: boolean;
	}, asyncCallback?: Function): any {
		// ?
		this.mockMethods[methodName].call({})
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
		this.mockStartupFunctions.push(fcn)
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
}
export function setup () {
	return {
		Meteor: MeteorMock
	}
}

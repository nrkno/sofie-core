// import { Meteor } from 'meteor/meteor'

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

export class MeteorMock {

	static isClient: boolean = false
	static isCordova: boolean = false
	static isServer: boolean = true
	static isProduction: boolean = false
	static release: string = ''

	static settings: any = {}

	static mockMethods: {[name: string]: Function} = {}
	static mockUser: Meteor.User | undefined = undefined
	static mockStartupFunctions: Function[] = []

	static user (): Meteor.User | undefined {
		return this.mockUser
	}
	static userId (): string | undefined {
		return this.mockUser ? this.mockUser._id : undefined
	}
	static Error (errorCode: number, reason?: string): Meteor.Error {
		return {
			error: errorCode,
			reason: reason
		}
	}
	static methods (methods: {[name: string]: Function}) {
		Object.assign(this.mockMethods, methods)
	}
	static call (methodName: string, args: any[]) {
		this.mockMethods[methodName].call({}, args)
	}
	static apply (methodName: string, args: any[], options?: {
		wait?: boolean;
		onResultReceived?: Function;
		returnStubValue?: boolean;
		throwStubExceptions?: boolean;
	}, asyncCallback?: Function): any {
		// ?
		this.mockMethods[methodName].call({})
	}
	static absoluteUrl (path?: string): string {
		return path + '' // todo
	}
	static setTimeout (fcn: Function, time: number): number {
		return setTimeout(fcn, time)
	}
	static clearTimeout (timer: number) {
		clearTimeout(timer)
	}
	static setInterval (fcn: Function, time: number): number {
		return setInterval(fcn, time)
	}
	static clearInterval (timer: number) {
		clearInterval(timer)
	}
	static defer (fcn: Function) {
		return setTimeout(fcn, 0)
	}

	static startup (fcn: Function): void {
		this.mockStartupFunctions.push(fcn)
	}

	static wrapAsync (fcn: Function, context?: Object): any {
		return (...args: any[]) => {
			// don't know how to implement, in a mock...
			fcn.apply(context, [...args])
		}
	}

	static bindEnvironment (fcn: Function): any {
		return fcn
	}

	/*
	static subscribe () {

	}
	*/
}
export function setup () {
	return {
		Meteor: MeteorMock
	}
}

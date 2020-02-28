import * as _ from 'underscore'
import { MeteorPromiseCall } from '../lib'
import { NewPlayoutAPI, PlayoutAPIMethods } from './playout'
import { NewUserActionAPI, UserActionAPIMethods } from './userActions'


/** All methods typings are defined here, the actual implementation is defined in other places */
export type MethodsBase = {
	[key: string]: (...args: any[]) => Promise<any>
}
interface IMeteorCall {
	playout: NewPlayoutAPI
	userAction: NewUserActionAPI
}
export const MeteorCall: IMeteorCall = {
	playout: makeMethods(PlayoutAPIMethods),
	userAction: makeMethods(UserActionAPIMethods)
}
function makeMethods (methods: any): any {
	const o = {}
	_.each(methods, (value: any, methodName: string) => {
		o[methodName] = (...args) => MeteorPromiseCall(value, ...args)
	})
	return o
}
export interface MethodContext {
	userId?: string
	connection: {
		clientAddress: string
	}
}

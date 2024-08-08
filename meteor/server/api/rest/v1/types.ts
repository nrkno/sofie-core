import { UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { Meteor } from 'meteor/meteor'
import { ClientAPI } from '../../../../lib/api/client'
import { Credentials } from '../../../security/lib/credentials'
import { MethodContextAPI } from '../../../../lib/api/methods'

export type APIRegisterHook<T> = <Params, Body, Response>(
	method: 'get' | 'post' | 'put' | 'delete',
	route: string,
	errMsgs: Map<number, UserErrorMessage[]>,
	serverAPIFactory: APIFactory<T>,
	handler: (
		serverAPI: T,
		connection: Meteor.Connection,
		event: string,
		params: Params,
		body: Body
	) => Promise<ClientAPI.ClientResponse<Response>>
) => void

export interface APIFactory<T> {
	createServerAPI(context: ServerAPIContext): T
}

export interface ServerAPIContext {
	getMethodContext(connection: Meteor.Connection): MethodContextAPI
	getCredentials(): Credentials
}

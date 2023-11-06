import { Meteor } from 'meteor/meteor'
import { MethodContextAPI } from '../../../../lib/api/methods'
import { Credentials } from '../../../security/lib/credentials'
import { UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { ClientAPI } from '../../../../lib/api/client'

export type APIRegisterHook<T> = <Params, Body, Response>(
	method: 'get' | 'post' | 'put' | 'delete',
	route: string,
	errMsgs: Map<number, UserErrorMessage[]>,
	handler: (
		serverAPI: T,
		connection: Meteor.Connection,
		event: string,
		params: Params,
		body: Body
	) => Promise<ClientAPI.ClientResponse<Response>>,
	serverAPIFactory?: APIFactory<T> // TODO: merge conflict with R51
) => void

export interface APIFactory<T> {
	createServerAPI(context: ServerAPIContext): T
}

export interface ServerAPIContext {
	getMethodContext(connection: Meteor.Connection): MethodContextAPI
	getCredentials(): Credentials
}

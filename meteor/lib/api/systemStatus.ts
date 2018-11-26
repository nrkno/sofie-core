import { StatusCode } from '../../server/systemStatus'

export type ExternalStatus = 'OK' | 'FAIL' | 'WARNING' | 'UNDEFINED'
export interface CheckObj {
	description: string,
	status: ExternalStatus,
	_status: StatusCode,
	errors: Array<string>
}
export interface StatusResponse {
	name: string,
	status: ExternalStatus,
	_status: StatusCode,
	documentation: string,
	instanceId?: string,
	updated?: string,
	appVersion?: string,
	version?: '2', // version of healthcheck
	utilises?: Array<string>,
	consumers?: Array<string>,
	checks?: Array<CheckObj>,
	_internal: {
		// statusCode: StatusCode,
		statusCodeString: string,
		messages: Array<string>
	},
	components?: Array<StatusResponse>
}

export enum SystemStatusAPI {
	getSystemStatus = 'systemStatus.getSystemStatus'
}

export namespace ClientAPI {
	export enum methods {
		'execMethod' = 'client.execMethod',
		'callPeripheralDeviceFunction' = 'client.callPeripheralDeviceFunction'
	}

	export interface ClientResponse {
		error?: number,
		success?: number,
		message?: string,
		details?: any
	}
}

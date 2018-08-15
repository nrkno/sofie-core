export namespace ClientAPI {
	export enum methods {
		'execMethod' = 'client.execMethod'
	}

	export interface ClientResponse {
		error?: number,
		success?: number,
		message?: string,
		details?: any
	}
}

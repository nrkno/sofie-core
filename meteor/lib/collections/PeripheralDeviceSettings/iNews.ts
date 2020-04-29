export interface INewsDeviceSettings {
	hosts: Array<INewsHost>
	user: string
	password: string
	queues: Array<INewsQueue>
}

export interface INewsHost {
	_id: string
	host: string
}

export interface INewsQueue {
	_id: string
	queue: string
}

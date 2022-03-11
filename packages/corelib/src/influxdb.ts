import * as Influx from 'influx'

export interface InfluxConfig {
	host: string | undefined
	port: number
	user: string
	password: string | undefined
	database: string
}

let client: Influx.InfluxDB | undefined
let additionalTags: Record<string, string> = {}
let timeout: NodeJS.Timeout | undefined = undefined
let bufferedTraces: Influx.IPoint[] = []

export interface Trace {
	/** id of this trace, should be formatted as namespace:id */
	measurement: string
	/** timestamp of when trace was started */
	start: number
	/** Tags to differentiate data sources */
	tags: Record<string, string>
}
export interface FinishedTrace extends Trace {
	/** timestamp of when trace was ended */
	ended: number
	/** duration of the trace */
	duration: number
}

export function startTrace(measurement: string, tags?: Record<string, string>): Trace {
	return {
		measurement,
		tags: tags ?? {},
		start: Date.now(),
	}
}

export function endTrace(trace: Trace): FinishedTrace {
	return {
		...trace,
		ended: Date.now(),
		duration: Date.now() - trace.start,
	}
}

export function sendTrace(trace: FinishedTrace): void {
	if (!client || Number.isNaN(trace.duration)) return

	const point = {
		measurement: trace.measurement,
		tags: {
			...trace.tags,
			...additionalTags,
		},
		fields: {
			duration: trace.duration,
		},
		timestamp: trace.start * 1e6,
	}

	bufferedTraces.push(point)

	if (bufferedTraces.length >= 2500) {
		if (timeout) {
			clearTimeout(timeout)
			timeout = undefined
		}
		emptyBuffers()
	} else {
		if (!timeout) {
			timeout = setTimeout(() => {
				emptyBuffers()
				timeout = undefined
			}, 30 * 1000)
		}
	}
}

function emptyBuffers() {
	const points = bufferedTraces // create a reference so we can safely empty bufferedTraces
	bufferedTraces = []

	client?.writePoints(points).catch((e) => console.log(e)) // only tracing so not relevant enough to throw errors, stdout should go to debug
}

export function initInfluxdb(config: InfluxConfig, tags: Record<string, string>): void {
	if (client) throw new Error('InfluxDB is already initialised')

	if (config.host) {
		const url = /(https?:\/\/)?([\s\S]+)/g.exec(config.host || '')
		const hostname = url?.[2]
		const protocol = (url?.[1]?.replace('://', '') || 'https') as 'http' | 'https'
		client = new Influx.InfluxDB({
			database: config.database,
			host: hostname,
			port: config.port,
			username: config.user,
			password: config.password,
			protocol,
		})

		additionalTags = tags
	}
}

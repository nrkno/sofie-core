import * as Influx from 'influx'
import * as os from 'os'

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

export interface TimeTrace {
	measurement: FinishedTrace['measurement']
	tags: FinishedTrace['tags']

	/** timestamp of when trace was started */
	start: number
}
export interface FinishedTrace {
	/** id of this trace, should be formatted as namespace:id */
	measurement: string
	/** Tags to differentiate data sources */
	tags?: Record<string, string>
	timestamp: number

	/** metrics */
	fields?: Record<string, number>
}

export function startTrace(measurement: string, tags?: Record<string, string>): TimeTrace {
	return {
		measurement,
		tags: tags ?? {},
		start: Date.now(),
	}
}

export function endTrace(trace: TimeTrace): FinishedTrace | null {
	const duration = Date.now() - trace.start
	if (Number.isNaN(duration)) return null

	return {
		measurement: trace.measurement,
		tags: trace.tags,
		timestamp: trace.start,
		fields: {
			duration: duration,
		},
	}
}

export function sendTrace(trace: FinishedTrace | null): void {
	if (!client || !trace) return

	const point = {
		measurement: trace.measurement,
		tags: {
			...trace.tags,
			...additionalTags,
		},
		fields: {
			...trace.fields,
		},
		timestamp: trace.timestamp * 1e6,
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

		additionalTags = {
			...tags,
			host: os.hostname(),
		}
	}
}

// import { getSystemVersion } from './lib'

// const config = {
// 	host: process.env.INFLUX_HOST || Meteor.settings.influxHost,
// 	database: process.env.INFLUX_DATABASE || Meteor.settings.influxDatabase || 'sofie',
// 	port: process.env.INFLUX_PORT || Meteor.settings.influxPort || 8086,
// 	user: process.env.INFLUX_USER || Meteor.settings.influxUser || 'sofie',
// 	password: process.env.INFLUX_PASSWORD || Meteor.settings.influxPassword,
// }

// export interface InfluxConfig {
// 	host: string | undefined
// 	port: number
// 	user: string
// 	password: string | undefined
// 	database: string
// }

// const url = /(https?:\/\/)?([\s\S]+)/g.exec(config.host || '')
// const hostname = url?.[2]
// const protocol = (url?.[1]?.replace('://', '') || 'https') as 'http' | 'https'
// const client = config.host
// 	? new Influx.InfluxDB({
// 			database: config.database,
// 			host: hostname,
// 			port: config.port,
// 			username: config.user,
// 			password: config.password,
// 			protocol,
// 	  })
// 	: undefined

// const versions = getVersions()
// let timeout: number | undefined = undefined
// let bufferedTraces: Influx.IPoint[] = []

export interface Trace {
	/** id of this trace, should be formatted as namespace:id */
	measurement: string
	/** timestamp of when trace was started */
	start: number
	/** Tags to differentiate data sources */
	tags?: Record<string, string>
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
		tags,
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

export function sendTrace(_trace: FinishedTrace) {
	// TODO
	// if (!client || Number.isNaN(trace.duration)) return
	// const point = {
	// 	measurement: 'core:' + trace.measurement,
	// 	tags: {
	// 		...trace.tags,
	// 		host: process.env.APP_HOST || '',
	// 		...versions,
	// 	},
	// 	fields: {
	// 		duration: trace.duration,
	// 	},
	// 	timestamp: trace.start * 1e6,
	// }
	// bufferedTraces.push(point)
	// if (bufferedTraces.length >= 2500) {
	// 	if (timeout) {
	// 		Meteor.clearTimeout(timeout)
	// 		timeout = undefined
	// 	}
	// 	Meteor.setTimeout(() => emptyBuffers(), 0) // make sure this doesnt run synchronous
	// } else {
	// 	if (!timeout) {
	// 		timeout = Meteor.setTimeout(() => {
	// 			emptyBuffers()
	// 			timeout = undefined
	// 		}, 30 * 1000)
	// 	}
	// }
}

// function getVersions(): Record<string, string> {
// 	const versions: { [packageName: string]: string } = {
// 		'job-worker': getSystemVersion(),
// 	}

// 	return versions
// }

// function emptyBuffers() {
// 	const points = bufferedTraces // create a reference so we can safely empty bufferedTraces
// 	bufferedTraces = []

// 	client?.writePoints(points).catch((e) => console.log(e)) // only tracing so not relevant enough to throw errors, stdout should go to debug
// }

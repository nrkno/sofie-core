import * as Influx from 'influx'
import { config } from './config'

export interface InfluxConfig {
	host: string | undefined
	port: number
	user: string
	password: string | undefined
	database: string
}

const client = config.influx.host
	? new Influx.InfluxDB({
			database: config.influx.database,
			host: config.influx.host,
			port: 8086,
			username: config.influx.user,
			password: config.influx.password,
	  })
	: undefined

const versions = getVersions()
let timeout: NodeJS.Timeout | undefined = undefined
let bufferedTraces: Influx.IPoint[] = []

export function sendTrace(trace: Record<string, any>) {
	if (!client) return

	const point = {
		measurement: trace.measurement,
		tags: {
			...trace.tags,
			// host: ???
			...versions,
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

function getVersions(): Record<string, string> {
	const versions: { [packageName: string]: string } = {}

	if (process.env.npm_package_version) {
		versions['processVersion'] = process.env.npm_package_version
	}

	try {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const pkgInfo = require(`timeline-state-resolver/package.json`)
		versions['tsrVersion'] = pkgInfo.version || 'N/A'
	} catch (e) {
		// this.logger.error(`Failed to load package.json for lib "${pkgName}": ${e}`)
	}

	return versions
}

function emptyBuffers() {
	const points = bufferedTraces // create a reference so we can safely empty bufferedTraces
	bufferedTraces = []

	client?.writePoints(points).catch(() => null) // only tracing so not relevant enough to throw errors
}

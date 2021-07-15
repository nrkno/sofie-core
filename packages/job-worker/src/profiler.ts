import * as Agent from 'elastic-apm-node'
import { logger } from './logging'

let active = false
export function setupApmAgent(): void {
	if (process.env.JEST_WORKER_ID) {
		return
	}

	const { APM_HOST, APM_SECRET, KIBANA_INDEX, APP_HOST } = process.env

	if (APM_HOST && APP_HOST) {
		logger.info(`APM agent starting up`)
		Agent.start({
			serviceName: KIBANA_INDEX || 'tv-automation-server-core',
			hostname: APP_HOST,
			serverUrl: APM_HOST,
			secretToken: APM_SECRET,
			active: true,
			transactionSampleRate: 1, // system.apm.transactionSampleRate,
		})
		active = true
	} else {
		logger.info(`APM agent inactive`)
		Agent.start({
			serviceName: KIBANA_INDEX || 'tv-automation-server-core',
			active: false,
		})
	}
}

// APM types are not exported https://github.com/elastic/apm-agent-nodejs/pull/1775
export type ApmTransaction = ReturnType<typeof Agent.startTransaction>

export function startTransaction(name: string, namespace: string): ApmTransaction | undefined {
	if (!active) return undefined
	return Agent.startTransaction(name, namespace)
}

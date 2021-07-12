import { IDirectCollections } from '../collection'
import * as Agent from 'elastic-apm-node'

// APM types are not exported https://github.com/elastic/apm-agent-nodejs/pull/1775
export type ApmSpan = ReturnType<typeof Agent.startSpan>

export interface JobContext {
	directCollections: IDirectCollections

	startSpan(name: string): ApmSpan
}

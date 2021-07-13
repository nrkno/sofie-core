import { IDirectCollections } from '../collection'
import * as Agent from 'elastic-apm-node'
import { ReadonlyDeep } from 'type-fest'
import { WrappedShowStyleBlueprint, WrappedStudioBlueprint } from '../blueprints/cache'

// APM types are not exported https://github.com/elastic/apm-agent-nodejs/pull/1775
export type ApmSpan = ReturnType<typeof Agent.startSpan>

export interface JobContext {
	readonly directCollections: Readonly<IDirectCollections>

	readonly studioBlueprint: ReadonlyDeep<WrappedStudioBlueprint>
	readonly showStyleBlueprint: ReadonlyDeep<WrappedShowStyleBlueprint>

	startSpan(name: string): ApmSpan
}

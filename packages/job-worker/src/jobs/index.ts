import { IDirectCollections } from '../collection'
import { ReadonlyDeep } from 'type-fest'
import { WrappedShowStyleBlueprint, WrappedStudioBlueprint } from '../blueprints/cache'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ApmSpan } from '../profiler'

export { ApmSpan }

export interface JobContext {
	readonly directCollections: Readonly<IDirectCollections>

	readonly studioId: StudioId

	// TODO - these probably shouldnt be here because they relate to a rundown, and not a job
	readonly studioBlueprint: ReadonlyDeep<WrappedStudioBlueprint>
	readonly showStyleBlueprint: ReadonlyDeep<WrappedShowStyleBlueprint>

	startSpan(name: string): ApmSpan
}

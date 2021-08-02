import { IDirectCollections } from '../collection'
import { ReadonlyDeep } from 'type-fest'
import { WrappedShowStyleBlueprint, WrappedStudioBlueprint } from '../blueprints/cache'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ISettings } from '@sofie-automation/corelib/dist/settings'
import { ApmSpan } from '../profiler'

export { ApmSpan }

export interface JobContext {
	readonly directCollections: Readonly<IDirectCollections>

	readonly settings: ReadonlyDeep<ISettings>

	readonly studioId: StudioId

	// TODO - these probably shouldnt be here because they relate to a rundown, and not a job
	readonly studioBlueprint: ReadonlyDeep<WrappedStudioBlueprint>
	readonly showStyleBlueprint: ReadonlyDeep<WrappedShowStyleBlueprint>

	startSpan(name: string): ApmSpan
}

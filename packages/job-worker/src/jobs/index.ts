import { IDirectCollections } from '../db'
import { ReadonlyDeep } from 'type-fest'
import { WrappedStudioBlueprint } from '../blueprints/cache'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ISettings } from '@sofie-automation/corelib/dist/settings'
import { ApmSpan } from '../profiler'

export { ApmSpan }

export interface JobContext {
	readonly directCollections: Readonly<IDirectCollections>

	readonly settings: ReadonlyDeep<ISettings>

	readonly studioId: StudioId

	// TODO - should this be here?
	readonly studioBlueprint: ReadonlyDeep<WrappedStudioBlueprint>

	startSpan(name: string): ApmSpan
}

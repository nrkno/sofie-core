import { IRundownContext, IBlueprintSegmentRundown } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ProcessedStudioConfig, ProcessedShowStyleConfig } from '../config'
import { ProcessedShowStyleCompound } from '../../jobs'
import { convertRundownToBlueprintSegmentRundown } from './lib'
import { ContextInfo } from './CommonContext'
import { ShowStyleContext } from './ShowStyleContext'

/** Rundown */

export class RundownContext extends ShowStyleContext implements IRundownContext {
	readonly rundownId: string
	readonly rundown: Readonly<IBlueprintSegmentRundown>
	readonly _rundown: ReadonlyDeep<DBRundown>
	readonly playlistId: RundownPlaylistId

	constructor(
		contextInfo: ContextInfo,
		studio: ReadonlyDeep<DBStudio>,
		studioBlueprintConfig: ProcessedStudioConfig,
		showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		showStyleBlueprintConfig: ProcessedShowStyleConfig,
		rundown: ReadonlyDeep<DBRundown>
	) {
		super(contextInfo, studio, studioBlueprintConfig, showStyleCompound, showStyleBlueprintConfig)

		this.rundownId = unprotectString(rundown._id)
		this.rundown = convertRundownToBlueprintSegmentRundown(rundown)
		this._rundown = rundown
		this.playlistId = rundown.playlistId
	}
}

import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import {
	TimelineComplete,
	TimelineCompleteGenerationVersions,
	TimelineObjGeneric,
} from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { ICacheBase2 } from '../cache/CacheBase'
import { ReadonlyDeep } from 'type-fest'

export interface StudioPlayoutModelBaseReadonly {
	readonly PeripheralDevices: ReadonlyDeep<PeripheralDevice[]>

	get Timeline(): TimelineComplete | null

	readonly isMultiGatewayMode: boolean
}

export interface StudioPlayoutModelBase extends StudioPlayoutModelBaseReadonly {
	setTimeline(timelineObjs: TimelineObjGeneric[], generationVersions: TimelineCompleteGenerationVersions): void
}

export type DeferredAfterSaveFunction = (cache: StudioPlayoutModelBaseReadonly) => void | Promise<void>

export interface StudioPlayoutModel extends StudioPlayoutModelBase, ICacheBase2 {
	readonly isStudio: true

	readonly RundownPlaylists: ReadonlyDeep<DBRundownPlaylist[]>

	getActiveRundownPlaylists(excludeRundownPlaylistId?: RundownPlaylistId): ReadonlyDeep<DBRundownPlaylist[]>

	/** @deprecated */
	deferAfterSave(fcn: DeferredAfterSaveFunction): void
}

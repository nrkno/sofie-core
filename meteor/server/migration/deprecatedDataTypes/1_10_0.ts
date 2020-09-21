import { Time, literal, protectString } from '../../../lib/lib'
import { RundownImportVersions, RundownHoldState, DBRundown } from '../../../lib/collections/Rundowns'
import { RundownNote } from '../../../lib/api/notes'
import { TimelinePersistentState, TSR } from 'tv-automation-sofie-blueprints-integration'
import { DBRundownPlaylist, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { ShowStyleVariantId } from '../../../lib/collections/ShowStyleVariants'
import { StudioId, MappingsExt, IStudioSettings } from '../../../lib/collections/Studios'
import { ShowStyleBaseId } from '../../../lib/collections/ShowStyleBases'
import { PeripheralDeviceId } from '../../../lib/collections/PeripheralDevices'
import { PartId } from '../../../lib/collections/Parts'
import { BlueprintId } from '../../../lib/collections/Blueprints'

export interface IConfigItem {
	_id: string
	value: any
}

export interface ITestToolsConfig {
	recordings: {
		deviceId?: string
		channelIndex?: number
		channelFormat: TSR.ChannelFormat
		decklinkDevice?: number
		filePrefix?: string
		urlPrefix?: string
	}
}

export interface Studio {
	_id: StudioId
	/** User-presentable name for the studio installation */
	name: string
	/** Id of the blueprint used by this studio-installation */
	blueprintId?: BlueprintId

	/** Mappings between the physical devices / outputs and logical ones */
	mappings: MappingsExt

	/** List of which ShowStyleBases this studio wants to support */
	supportedShowStyleBase: Array<ShowStyleBaseId>

	/** Config values are used by the Blueprints */
	config: Array<IConfigItem>
	testToolsConfig?: ITestToolsConfig

	settings: IStudioSettings

	_rundownVersionHash: string
}

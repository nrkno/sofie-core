import { ITranslatableMessage } from '../lib/translations'
import { PartId, ShowStyleBaseId, StudioId, TriggeredActionId } from '../core/model/Ids'
import { ProtectedString } from '../lib/protectedString'
import { ISourceLayer, IOutputLayer, SourceLayerType, SomeActionIdentifier } from '../core/model/ShowStyle'
import { PieceLifespan } from '../core/model/Rundown'

export type DeviceTriggerMountedActionId = ProtectedString<'deviceTriggerMountedActionId'>

export type DeviceActionId = ProtectedString<'DeviceActionId'>

export type DeviceTriggerArguments = Record<string, string | number | boolean>

export interface IWrappedAdLibBase {
	_id: ProtectedString<any>
	_rank: number
	partId: PartId | null
	type: unknown
	label: string | ITranslatableMessage
	sourceLayerId?: ISourceLayer['_id']
	outputLayerId?: IOutputLayer['_id']
	expectedDuration?: number | PieceLifespan
	item: unknown
}

export interface DeviceTriggerMountedAction {
	_id: DeviceTriggerMountedActionId
	studioId: StudioId
	showStyleBaseId: ShowStyleBaseId
	deviceId: string
	deviceTriggerId: string
	values: DeviceTriggerArguments
	actionId: DeviceActionId
	actionType: SomeActionIdentifier
	name?: string | ITranslatableMessage
}

export type PreviewWrappedAdLibId = ProtectedString<'previewWrappedAdLibId'>
export type PreviewWrappedAdLib = Omit<IWrappedAdLibBase, '_id'> & {
	_id: PreviewWrappedAdLibId
	studioId: StudioId
	showStyleBaseId: ShowStyleBaseId
	triggeredActionId: TriggeredActionId
	actionId: DeviceActionId
	sourceLayerType?: SourceLayerType
	sourceLayerName?: {
		name?: string
		abbreviation?: string
	}
	isCurrent?: boolean
	isNext?: boolean
}

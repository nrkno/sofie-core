import { ISourceLayer, ITranslatableMessage, SourceLayerType } from '@sofie-automation/blueprints-integration'
import {
	AdLibActionId,
	PieceId,
	RundownBaselineAdLibActionId,
	ShowStyleBaseId,
	StudioId,
	TriggeredActionId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { ExecutableAction } from './actionFactory'
import { IWrappedAdLib } from './actionFilterChainCompilers'

export type MountedTrigger = (MountedGenericTrigger | MountedAdLibTrigger) & MountedHotkeyMixin
export type MountedDeviceTrigger = (MountedGenericTrigger | MountedAdLibTrigger) & MountedDeviceMixin

/** A generic action that will be triggered by hotkeys (generic, i.e. non-AdLib) */
export interface MountedGenericTrigger extends MountedTriggerCommon {
	_id: MountedGenericTriggerId
	/** The ID of the action that will be triggered */
	triggeredActionId: TriggeredActionId
	/** Hint that all actions of this trigger are adLibs */
	adLibOnly: boolean
}

type MountedGenericTriggerId = ProtectedString<'mountedGenericTriggerId'>

interface MountedTriggerCommon {
	/** Rank of the Action that is mounted under `keys` */
	_rank: number
	/** A label of the action, if available */
	name?: string | ITranslatableMessage
}

export interface MountedHotkeyMixin {
	/** Keys or combos that have a listener mounted to */
	keys: string[]
	/** Final keys in the combos, that can be used for figuring out where on the keyboard this action is mounted */
	finalKeys: string[]
}

export type DeviceTriggerArguments = Record<string, string | number | boolean>

interface MountedDeviceMixin {
	deviceId: string
	triggerId: string
	values?: DeviceTriggerArguments
}

/** An AdLib action that will be triggered by hotkeys (can be AdLib, RundownBaselineAdLib, AdLib Action, Clear source layer, Sticky, etc.) */
export interface MountedAdLibTrigger extends MountedTriggerCommon {
	_id: MountedAdLibTriggerId
	/** The ID of the action that will be triggered */
	triggeredActionId: TriggeredActionId
	/** The type of the adLib being targeted */
	type: IWrappedAdLib['type']
	/** The ID in the collection specified by `type` */
	targetId: AdLibActionId | RundownBaselineAdLibActionId | PieceId | ISourceLayer['_id']
	/** SourceLayerId of the target, if available */
	sourceLayerId?: ISourceLayer['_id']
	/** A label of the target if available */
	targetName?: string | ITranslatableMessage
}

export type MountedAdLibTriggerId = ProtectedString<'mountedAdLibTriggerId'>

export type DeviceTriggerMountedActionId = ProtectedString<'deviceTriggerMountedActionId'>

export type DeviceActionId = ProtectedString<'DeviceActionId'>

export interface DeviceTriggerMountedAction {
	_id: DeviceTriggerMountedActionId
	studioId: StudioId
	showStyleBaseId: ShowStyleBaseId
	deviceId: string
	deviceTriggerId: string
	values: DeviceTriggerArguments
	actionId: DeviceActionId
	actionType: ExecutableAction['action']
	name?: string | ITranslatableMessage
}

export type PreviewWrappedAdLibId = ProtectedString<'previewWrappedAdLibId'>
export type PreviewWrappedAdLib = Omit<IWrappedAdLib, '_id'> & {
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

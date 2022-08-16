import { ISourceLayer, ITranslatableMessage } from '@sofie-automation/blueprints-integration'
import { PieceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { AdLibActionId } from '../../collections/AdLibActions'
import { RundownBaselineAdLibActionId } from '../../collections/RundownBaselineAdLibActions'
import { TriggeredActionId } from '../../collections/TriggeredActions'
import { IWrappedAdLib } from './actionFilterChainCompilers'

export type MountedTrigger = MountedGenericTrigger | MountedAdLibTrigger

/** A generic action that will be triggered by hotkeys (generic, i.e. non-AdLib) */
export interface MountedGenericTrigger extends MountedTriggerBase {
	_id: MountedGenericTriggerId
	/** Rank of the Action that is mounted under `keys1 */
	_rank: number
	/** The ID of the action that will be triggered */
	triggeredActionId: TriggeredActionId
	/** Hint that all actions of this trigger are adLibs */
	adLibOnly: boolean
}

type MountedGenericTriggerId = ProtectedString<'mountedGenericTriggerId'>

interface MountedTriggerBase {
	/** Rank of the Action that is mounted under `keys` */
	_rank: number
	/** Keys or combos that have a listener mounted to */
	keys: string[]
	/** Final keys in the combos, that can be used for figuring out where on the keyboard this action is mounted */
	finalKeys: string[]
	/** A label of the action, if available */
	name?: string | ITranslatableMessage
}

/** An AdLib action that will be triggered by hotkeys (can be AdLib, RundownBaselineAdLib, AdLib Action, Clear source layer, Sticky, etc.) */
export interface MountedAdLibTrigger extends MountedTriggerBase {
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

type MountedAdLibTriggerId = ProtectedString<'mountedAdLibTriggerId'>

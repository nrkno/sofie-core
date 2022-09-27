import { SourceLayerType } from './content'
import { IBlueprintConfig } from './common'

export interface IBlueprintShowStyleBase {
	_id: string

	/** Id of the blueprint in the database */
	blueprintId: string

	/** "Outputs" in the UI */
	outputLayers: IOutputLayer[]
	/** "Layers" in the GUI */
	sourceLayers: ISourceLayer[]

	/** Config values are used by the Blueprints */
	blueprintConfig: IBlueprintConfig
}
export interface IBlueprintShowStyleVariant {
	_id: string
	name: string

	/** Config values are used by the Blueprints */
	blueprintConfig: IBlueprintConfig
}

/** A single source layer, f.g Cameras, VT, Graphics, Remotes */
export interface ISourceLayer {
	_id: string
	/** Rank for ordering */
	_rank: number
	/** User-presentable name for the source layer */
	name: string
	/** Abbreviation for display in the countdown screens */
	abbreviation?: string
	type: SourceLayerType
	/** Source layer exclusivity group. When adLibbing, only a single piece can exist whitin an exclusivity group */
	exclusiveGroup?: string
	/** Use special treatment for remote inputs */
	isRemoteInput?: boolean
	/** Use special treatment for guest inputs */
	isGuestInput?: boolean
	/** Should this layer be clearable */
	isClearable?: boolean
	/** Last used sticky item on a layer is remembered and can be returned to using the sticky hotkey */
	isSticky?: boolean
	/** Whether sticky items should only use original pieces on this layer (not inserted via an adlib) */
	stickyOriginalOnly?: boolean
	/** Should adlibs on this source layer be queueable */
	isQueueable?: boolean
	/** If set to true, the layer will be hidden from the user in Rundown View */
	isHidden?: boolean
	/** If set to true, items in the layer can be disabled by the user (the "G"-shortcut) */
	allowDisable?: boolean
	/** If set to true, items in this layer will be used for presenters screen display */
	onPresenterScreen?: boolean
	/** If set to true, this layer will receive a column of it's own in the List View */
	onListViewColumn?: boolean
	/** If set to true, adLibs on this layer will receive a column of it's own in the List View */
	onListViewAdLibColumn?: boolean
}

/** A layer output group, f.g. PGM, Studio Monitor 1, etc. */
export interface IOutputLayer {
	_id: string
	/** User-presentable name for the layer output group */
	name: string
	/** Rank for ordering */
	_rank: number
	/**
	 * PGM treatment of this output should be in effect
	 * (generate PGM Clean out based on SourceLayer properties)
	 */
	isPGM: boolean
	/** Is the output layer collapsed by default */
	isDefaultCollapsed?: boolean
	/** is the output flattened (all source layers presented on the same layer) */
	isFlattened?: boolean
}

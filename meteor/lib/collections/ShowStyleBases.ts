import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, applyClassToDocument } from '../lib'
import { SourceLayerType } from 'tv-automation-sofie-blueprints-integration'
import { IConfigItem } from './StudioInstallations'

export interface IOutputLayerBase {
	_id: string
	/** User-presentable name for the layer output group */
	name?: string
	/** Rank for ordering */
	_rank?: number
}

/** A layer output group, f.g. PGM, Studio Monitor 1, etc. */
export interface IOutputLayer extends IOutputLayerBase {
	_id: string
	/** User-presentable name for the layer output group */
	name: string
	/** Rank for ordering */
	_rank: number
	/** PGM treatment of this output should be in effect
	 * (generate PGM Clean out based on SourceLayer properties)
	 */
	isPGM: boolean
}
/** A single source layer, f.g Cameras, VT, Graphics, Remotes */
export interface ISourceLayerBase {
	_id: string
	/** Rank for ordering */
	_rank?: number
	/** User-presentable name for the source layer */
	name?: string
	/** Use special treatment for remote inputs */
	isRemoteInput?: boolean
	/** Use special treatment for guest inputs */
	isGuestInput?: boolean
	/** Available shortcuts to be used for ad-lib items assigned to this sourceLayer - comma separated list allowing for chords (keyboard sequences) */
	activateKeyboardHotkeys?: string
	/** Single 'clear all from this sourceLayer' keyboard shortcut */
	clearKeyboardHotkey?: string
	/** Do global objects get to be assigned hotkeys? */
	assignHotkeysToGlobalAdlibs?: boolean
	/** Last used sticky item on a layer is remembered and can be returned to using the sticky hotkey */
	isSticky?: boolean
	/** Keyboard shortcut to be used to reuse a sticky item on this layer */
	activateStickyKeyboardHotkey?: string
	/** Should adlibs on this source layer be queueable */
	isQueueable?: boolean
	/** If set to true, the layer will be hidden from the user in Running Order View */
	isHidden?: boolean
	/** If set to true, items in the layer can be disabled by the user (the "G"-shortcut) */
	allowDisable?: boolean
	/** If set to true, items in this layer will be used for presenters screen display */
	onPresenterScreen?: boolean
}
export interface ISourceLayer extends ISourceLayerBase {
	/** Rank for ordering */
	_rank: number
	/** User-presentable name for the source layer */
	name: string
	/** Abbreviation for display in the countdown screens */
	abbreviation?: string
	type: SourceLayerType
	/** If set to true, the layer can handle any number of simultaneus Line Items */
	unlimited: boolean
	/** If set to true, the layer will be shown in PGM Clean */
	onPGMClean: boolean
	/** Source layer exclusivity group. When adLibbing, only a single SLI can exist whitin an exclusivity group */
	exclusiveGroup?: string
}

export interface HotkeyDefinition {
	_id: string
	key: string
	label: string
}

export interface DBShowStyleBase {
	_id: string
	/** Name of this show style */
	name: string
	/** Id of the blueprint used by this show-style */
	blueprintId: string

	/** "Outputs" in the UI */
	outputLayers: Array<IOutputLayer>
	/** "Layers" in the GUI */
	sourceLayers: Array<ISourceLayer>

	/** Config values are used by the Blueprints */
	config: Array<IConfigItem>

	hotkeyLegend?: Array<HotkeyDefinition>
}
export class ShowStyleBase implements DBShowStyleBase {
	public _id: string
	public name: string
	public blueprintId: string
	public outputLayers: Array<IOutputLayer>
	public sourceLayers: Array<ISourceLayer>
	public config: Array<IConfigItem>
	public hotkeyLegend?: Array<HotkeyDefinition>

	constructor (document: DBShowStyleBase) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
	}
}

export const ShowStyleBases: TransformedCollection<ShowStyleBase, DBShowStyleBase>
	= new Mongo.Collection<ShowStyleBase>('showStyleBases', {transform: (doc) => applyClassToDocument(ShowStyleBase, doc) })
registerCollection('ShowStyleBases', ShowStyleBases)

Meteor.startup(() => {
	if (Meteor.isServer) {
		// ShowStyleBases._ensureIndex({
		// 	_id: 1,
		// })
	}
})

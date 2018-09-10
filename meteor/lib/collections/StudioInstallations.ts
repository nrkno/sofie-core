import { Mongo } from 'meteor/mongo'
import { RundownAPI } from '../api/rundown'
import { TransformedCollection } from '../typings/meteor'
import { PlayoutDeviceType } from './PeripheralDevices'
import { LookaheadMode } from '../api/playout'
import { applyClassToDocument, registerCollection } from '../lib'
import * as _ from 'underscore'

// Imports from TSR (TODO make into an import)
export enum MappingLawoType {
	SOURCE = 'source'
}
export enum MappingAtemType {
	MixEffect,
	DownStreamKeyer,
	SuperSourceBox,
	Auxilliary,
	MediaPlayer,
	SuperSourceProperties
}
export interface Mappings {
	[layerName: string]: Mapping
}
export interface Mapping {
	device: PlayoutDeviceType,
	lookahead: LookaheadMode,
	deviceId: string
	// [key: string]: any
}
export interface MappingCasparCG extends Mapping {
	device: PlayoutDeviceType.CASPARCG,
	channel: number,
	layer: number
}
export interface MappingAbstract extends Mapping {
	device: PlayoutDeviceType.ABSTRACT,
	abstractPipe: number
}
export interface MappingAtem extends Mapping {
	device: PlayoutDeviceType.ATEM,
	mappingType: MappingAtemType
	index?: number
}
export interface MappingLawo extends Mapping {
	device: PlayoutDeviceType.LAWO,
	mappingType: MappingLawoType,
	identifier: string
}

/** A set of available layer groups in a given installation */
export interface DBStudioInstallation {
	_id: string
	/** User-presentable name for the studio installation */
	name: string
	/** All available layer groups in a given installation */
	outputLayers: Array<IOutputLayer>
	sourceLayers: Array<ISourceLayer>
	mappings: Mappings

	defaultShowStyle: string

	config: Array<IStudioConfigItem>
}

export interface ISourceLayerBase {
	_id: string
	/** Rank for ordering */
	_rank?: number
	/** User-presentable name for the source layer */
	name?: string
	/** Use special treatment for remote inputs */
	isRemoteInput?: boolean
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

export interface IStudioConfigItem {
	_id: string
	/** Value */
	value: string
}

/** A single source layer, f.g Cameras, VT, Graphics, Remotes */
export interface ISourceLayer extends ISourceLayerBase {
	/** Rank for ordering */
	_rank: number
	/** User-presentable name for the source layer */
	name: string
	/** Abbreviation for display in the countdown screens */
	abbreviation?: string
	type: RundownAPI.SourceLayerType
	/** If set to true, the layer can handle any number of simultaneus Line Items */
	unlimited: boolean
	/** If set to true, the layer will be shown in PGM Clean */
	onPGMClean: boolean
}

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

export class StudioInstallation implements DBStudioInstallation {
	public _id: string
	public name: string
	public outputLayers: Array<IOutputLayer>
	public sourceLayers: Array<ISourceLayer>
	public mappings: Mappings
	public defaultShowStyle: string
	public config: Array<IStudioConfigItem>
	constructor (document: DBStudioInstallation) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
	}
	public getConfigValue (name: string): string | null {
		const item = this.config.find((item) => {
			return (item._id === name)
		})
		if (item) {
			return item.value
		} else {
			return null
		}
	}
}

export const StudioInstallations: TransformedCollection<StudioInstallation, DBStudioInstallation>
	= new Mongo.Collection<StudioInstallation>('studioInstallation', {transform: (doc) => applyClassToDocument(StudioInstallation, doc) })
registerCollection('StudioInstallations', StudioInstallations)

import { Mongo } from 'meteor/mongo'
import { RundownAPI } from '../../lib/api/rundown'
import { TransformedCollection } from './typings'
import { PlayoutDeviceType } from './PeripheralDevices'

// Imports from TSR (TODO make into an import)
export enum MappingAtemType {
	MixEffect,
	DownStreamKeyer,
	SuperSourceBox,
	Auxilliary,
	MediaPlayer
}
export interface Mappings {
	[layerName: string]: Mapping
}
export interface Mapping {
	device: PlayoutDeviceType,
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
	channel: number
}

/** A set of available layer groups in a given installation */
export interface StudioInstallation {
	_id: string
	/** User-presentable name for the studio installation */
	name: string
	/** All available layer groups in a given installation */
	outputLayers: Array<IOutputLayer>
	sourceLayers: Array<ISourceLayer>
	mappings: Mappings
}

/** A single source layer, f.g Cameras, VT, Graphics, Remotes */
export interface ISourceLayer {
	_id: string
	/** Rank for ordering */
	_rank: number
	/** User-presentable name for the source layer */
	name: string
	type: RundownAPI.SourceLayerType
	/** If set to true, the layer can handle any number of simultaneus Line Items */
	unlimited: boolean
	/** If set to true, the layer will be shown in PGM Clean */
	onPGMClean: boolean
	/** If set to true, the layer should be treated as a Live Remote input layer */
	isRemoteInput?: boolean
}

/** A layer output group, f.g. PGM, Studio Monitor 1, etc. */
export interface IOutputLayer {
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

export const StudioInstallations: TransformedCollection<StudioInstallation, StudioInstallation>
	= new Mongo.Collection<StudioInstallation>('studioInstallation')

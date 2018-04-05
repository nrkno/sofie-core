import { Mongo } from 'meteor/mongo'
import { RundownAPI } from '../../lib/api/rundown'

/** A set of available layer groups in a given installation */
export interface StudioInstallation {
	_id: string
	/** User-presentable name for the studio installation */
	name: string
	/** All available layer groups in a given installation */
	outputLayers: Array<IOutputLayer>
	sourceLayers: Array<ISourceLayer>
}

/** A single source layer, f.g Cameras, VT, Graphics, Remotes */
export interface ISourceLayer {
	_id: string
		/** User-presentable name for the source layer */
	name: string
	type: RundownAPI.SourceLayerType
	  /** If set to true, the layer can handle any number of simultaneus Line Items */
	unlimited: boolean
		/** Ifs set to true, the layer will be shown in PGM Clean */
	onPGMClean: boolean
}

/** A layer output group, f.g. PGM, Studio Monitor 1, etc. */
export interface IOutputLayer {
	_id: string
		/** User-presentable name for the layer output group */
	name: string
		/** A utility flag to make sure that the PGM channel is always on top,
		 * and notify that PGM treatment of this output should be in effect
		 * (generate PGM Clean out based on SourceLayer properties)
		 */
	isPGM: boolean,
}

export const StudioInstallations = new Mongo.Collection<StudioInstallation>('studioInstallation')

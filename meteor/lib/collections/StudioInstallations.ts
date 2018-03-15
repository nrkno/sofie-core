import { Mongo } from 'meteor/mongo';
import {RundownAPI} from '../../lib/api/rundown';

/** A set of available layer groups in a given installation */
export interface StudioInstallation {
	_id: String,
	/** All available layer groups in a given installation */
	layerGroups: Array<ILayerOutput>,
  sourceLayers: Array<ISourceLayer>
}

/** A single source layer, f.g Cameras, VT, Graphics, Remotes */
export interface ISourceLayer {
	_id: String,
	/** User-presentable name for the source layer */
	name: String,
	type: RundownAPI.SourceLayerType,
  /** If set to true, the layer can handle any number of simultaneus Line Items */
  unlimited: Boolean,
	/** Ifs set to true, the layer will be shown in PGM Clean */
	onPGMClean: Boolean
}

/** A layer output group, f.g. PGM, Studio Monitor 1, etc. */
export interface ILayerOutput {
	_id: String,
	/** User-presentable name for the layer output group */
	name: String,
	/** A utility flag to make sure that the PGM channel is always on top,
	    and notify that PGM treatment of this output should be in effect
			(generate PGM Clean out based on SourceLayer properties) */
	isPGM: Boolean,
}

export const StudioInstallations = new Mongo.Collection<StudioInstallation>('studioInstallation');

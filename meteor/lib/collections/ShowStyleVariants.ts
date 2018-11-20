import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { TransformedCollection } from '../typings/meteor'
import { IConfigItem } from './StudioInstallations'
import { registerCollection } from '../lib'
import { ShowStyleBase, ShowStyleBases } from './ShowStyleBases'

export interface ShowStyleVariant {
	_id: string
	name: string
	/** Id of parent ShowStyleBase */
	showStyleBaseId: string
	/** Override studio-level source-layer properties (UI name, rank) */
	// sourceLayerOverrides?: Array<ISourceLayerBase>
	/** Override studio-level output-layer properties (UI name, rank) */
	// outputLayerOverrides?: Array<IOutputLayerBase>

	/** Config values are used by the Blueprints */
	config: Array<IConfigItem>
}

export interface ShowStyleCompound extends ShowStyleBase {
	showStyleVariantId: string
}
export function getShowStyleCompound (showStyleVariantId: string): ShowStyleCompound | undefined {
	let showStyleVariant = ShowStyleVariants.findOne(showStyleVariantId)
	if (!showStyleVariant) return
	let showStyleBase = ShowStyleBases.findOne(showStyleVariant.showStyleBaseId)
	if (!showStyleBase) return

	let configs: {[id: string]: IConfigItem} = {}
	_.each(showStyleBase.config, (config: IConfigItem) => {
		configs[config._id] = config
	})
	_.each(showStyleVariant.config, (config: IConfigItem) => {
		configs[config._id] = config
	})

	return _.extend(showStyleBase, {
		showStyleVariantId: showStyleVariant._id,
		name: `${showStyleBase.name}-${showStyleVariant.name}`,
		config: _.values(configs)
	})
}

export const ShowStyleVariants: TransformedCollection<ShowStyleVariant, ShowStyleVariant>
	= new Mongo.Collection<ShowStyleVariant>('showStyleVariants')
registerCollection('ShowStyleVariants', ShowStyleVariants)
Meteor.startup(() => {
	if (Meteor.isServer) {
		ShowStyleVariants._ensureIndex({
			showStyleBaseId: 1,
		})
	}
})

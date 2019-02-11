import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { TransformedCollection } from '../typings/meteor'
import { IConfigItem, IBlueprintShowStyleVariant } from 'tv-automation-sofie-blueprints-integration'
import { registerCollection, applyClassToDocument } from '../lib'
import { ShowStyleBase, ShowStyleBases } from './ShowStyleBases'

export interface DBShowStyleVariant extends IBlueprintShowStyleVariant {
	_id: string
	name: string
	/** Id of parent ShowStyleBase */
	showStyleBaseId: string

	/** Config values are used by the Blueprints */
	config: Array<IConfigItem>
}

export interface ShowStyleCompound extends ShowStyleBase {
	showStyleVariantId: string
}
export function getShowStyleCompound (showStyleVariantId: string): ShowStyleCompound | undefined {
	let showStyleVariant = ShowStyleVariants.findOne(showStyleVariantId)
	if (!showStyleVariant) return undefined
	let showStyleBase = ShowStyleBases.findOne(showStyleVariant.showStyleBaseId)
	if (!showStyleBase) return undefined

	let configs: {[id: string]: IConfigItem} = {}
	_.each(showStyleBase.config, (config: IConfigItem) => {
		configs[config._id] = config
	})
	// Override base configs with variant configs:
	_.each(showStyleVariant.config, (config: IConfigItem) => {
		configs[config._id] = config
	})

	return _.extend(showStyleBase, {
		showStyleVariantId: showStyleVariant._id,
		name: `${showStyleBase.name}-${showStyleVariant.name}`,
		config: _.values(configs)
	})
}

export class ShowStyleVariant implements DBShowStyleVariant {
	public _id: string
	public name: string
	public showStyleBaseId: string
	public config: Array<IConfigItem>

	constructor (document: DBShowStyleVariant) {
		_.each(_.keys(document), (key) => {
			this[key] = document[key]
		})
	}
}
export const ShowStyleVariants: TransformedCollection<ShowStyleVariant, DBShowStyleVariant>
	= new Mongo.Collection<ShowStyleVariant>('showStyleVariants', {transform: (doc) => applyClassToDocument(ShowStyleVariant, doc) })
registerCollection('ShowStyleVariants', ShowStyleVariants)
Meteor.startup(() => {
	if (Meteor.isServer) {
		ShowStyleVariants._ensureIndex({
			showStyleBaseId: 1,
		})
	}
})

import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { ISourceLayerBase, IOutputLayerBase } from './StudioInstallations'
import { registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'

export interface ShowStyle {
	_id: string
	name: string
	/** Override studio-level source-layer properties (UI name, rank) */
	sourceLayerOverrides?: Array<ISourceLayerBase>
	/** Override studio-level output-layer properties (UI name, rank) */
	outputLayerOverrides?: Array<IOutputLayerBase>
}

export const ShowStyles: TransformedCollection<ShowStyle, ShowStyle>
	= new Mongo.Collection<ShowStyle>('showStyles')
registerCollection('ShowStyles', ShowStyles)
Meteor.startup(() => {
	if (Meteor.isServer) {
		ShowStyles._ensureIndex({
			name: 1,
		})
	}
})

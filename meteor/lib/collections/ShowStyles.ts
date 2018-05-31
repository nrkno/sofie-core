import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from './typings'
import { ISourceLayerBase, IOutputLayerBase } from './StudioInstallations'

export interface ShowStyle {
	_id: string
	name: string
	sourceLayerOverrides?: Array<ISourceLayerBase>
	outputLayerOverrides?: Array<IOutputLayerBase>
	splitConfigurations: Array<object>
	graphicsTemplates: Array<object>
	wipesAndBumpers: Array<object>
	logicalSegmentLineItems: Array<object>
}

export const ShowStyles: TransformedCollection<ShowStyle, ShowStyle>
	= new Mongo.Collection<ShowStyle>('showStyles')

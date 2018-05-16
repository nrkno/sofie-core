import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from './typings'

export interface ShowStyle {
	_id: string
	name: string
	splitConfigurations: Array<object>
	graphicsTemplates: Array<object>
	wipesAndBumpers: Array<object>
	logicalSegmentLineItems: Array<object>
}

export const ShowStyles: TransformedCollection<ShowStyle, ShowStyle>
	= new Mongo.Collection<ShowStyle>('showStyles')

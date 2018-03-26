import { Mongo } from 'meteor/mongo'

export interface ShowStyle {
	_id: string,
	name: string,
	splitConfigurations: Array<object>,
	graphicsTemplates: Array<object>,
	wipesAndBumpers: Array<object>,
	logicalSegmentLineItems: Array<object>
}

export const ShowStyles = new Mongo.Collection<ShowStyle>('showStyles')

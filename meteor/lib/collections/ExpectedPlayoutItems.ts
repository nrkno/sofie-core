import { Meteor } from 'meteor/meteor'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection } from '../lib'
import { createMongoCollection } from './lib'
import { DeviceType as TSR_DeviceType } from 'timeline-state-resolver-types'

export interface ExpectedPlayoutItem {
	_id: string

	/** The studio installation this ExpectedPlayoutItem was generated in */
	studioId: string
	/** The rundown id that is the source of this PlayoutItem */
	rundownId: string
	/** The part id that is the source of this Playout Item */
	partId: string
	/** The piece id that is the source of this Playout Item */
	pieceId: string

	/** What type of playout device this item should be handled by */
	deviceSubType: TSR_DeviceType // subset of PeripheralDeviceAPI.DeviceSubType
	/** Which playout device this item should be handled by */
	// deviceId: string // Todo: implement deviceId support (later)

	content: ExpectedPlayoutItemContent
}
export type ExpectedPlayoutItemContent = ExpectedPlayoutItemContentVizMSE

export interface ExpectedPlayoutItemContentVizMSE { // TODO: This is a temporary implementation, and is a copy of the TSR typings
	templateName: string
	elementName: string | number // if number, it's a vizPilot element
	dataFields: string[]
}

export const ExpectedPlayoutItems: TransformedCollection<ExpectedPlayoutItem, ExpectedPlayoutItem>
	= createMongoCollection<ExpectedPlayoutItem>('expectedPlayoutItems')
registerCollection('ExpectedPlayoutItems', ExpectedPlayoutItems)
Meteor.startup(() => {
	if (Meteor.isServer) {
		ExpectedPlayoutItems._ensureIndex({
			studioId: 1
		})
		ExpectedPlayoutItems._ensureIndex({
			rundownId: 1
		})
	}
})

import { getCurrentTime } from '../../lib/lib'
import { Session } from 'meteor/session'
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import * as _ from 'underscore'
import { MeteorCall } from '../../lib/api/methods'
import { ClientCollections, PublicationCollections } from '../../lib/collections/lib'
import { logger } from '../../lib/logging'

// Note: These things are convenience functions to be used during development:

const windowAny: any = window

Meteor.startup(() => {
	windowAny['Collections'] = Object.fromEntries(ClientCollections.entries())
	windowAny['PublicationCollections'] = Object.fromEntries(PublicationCollections.entries())
})

windowAny['getCurrentTime'] = getCurrentTime
windowAny['Session'] = Session

function setDebugData() {
	Tracker.autorun(() => {
		const stats: Record<string, number> = {}
		for (const [name, collection] of ClientCollections.entries()) {
			stats[name] = collection.find().count()
		}
		console.log(
			_.map(stats, (count: any, name: string) => {
				return name + ': ' + count
			}).join('\n')
		)
	})
}
windowAny['setDebugData'] = setDebugData
const debugData = false
if (debugData) {
	console.log('Debug: comment out this!')
	setDebugData()
}
windowAny['MeteorCall'] = MeteorCall
windowAny['logger'] = logger

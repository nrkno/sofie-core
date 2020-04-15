import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { MongoQuery } from '../../lib/typings/meteor'
import { Credentials } from './lib/credentials'
import { logNotAllowed } from './lib/lib'
import { allowAccessToRundown } from './lib/security'
import { Rundowns, Rundown, RundownId } from '../../lib/collections/Rundowns'
import { protectString } from '../../lib/lib'
import { Parts } from '../../lib/collections/Parts'
import { Pieces } from '../../lib/collections/Pieces'
import { PieceInstance, PieceInstances } from '../../lib/collections/PieceInstances'
import { Segments, SegmentId } from '../../lib/collections/Segments'
import { PartInstances } from '../../lib/collections/PartInstances'
import { AdLibPieces } from '../../lib/collections/AdLibPieces'
import { IngestDataCache, IngestDataCacheObj } from '../../lib/collections/IngestDataCache'
import { AsRunLog, AsRunLogEvent } from '../../lib/collections/AsRunLog'
import { RundownBaselineAdLibPieces, RundownBaselineAdLibItem } from '../../lib/collections/RundownBaselineAdLibPieces'
import { ExpectedMediaItem, ExpectedMediaItems } from '../../lib/collections/ExpectedMediaItems'
import { PeripheralDevices, getStudioIdFromDevice } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { ExpectedPlayoutItem, ExpectedPlayoutItems } from '../../lib/collections/ExpectedPlayoutItems'
import { Settings } from '../../lib/Settings'

type RundownContent = { rundownId: RundownId }
export namespace RundownReadAccess {
	export function rundown (selector: MongoQuery<{_id: RundownId}>, cred: Credentials): boolean {
		return rundownContent({ rundownId: selector._id }, cred)
	}
	/** Handles read access for all rundown content (segments, parts, pieces etc..) */
	export function rundownContent (selector: MongoQuery<RundownContent>, cred: Credentials): boolean {
		check(selector, Object)
		if (!Settings.enableUserAccounts) return true
		if (!selector.rundownId) throw new Meteor.Error(400, 'selector must contain rundownId')

		const access = allowAccessToRundown(cred, selector.rundownId)
		if (!access.read) return logNotAllowed('Rundown content', access.reason)

		return true
	}
	export function segments (selector: MongoQuery<{ _id: SegmentId }>, cred: Credentials): boolean {
		check(selector, Object)
		if (!Settings.enableUserAccounts) return true
		if (!selector._id) throw new Meteor.Error(400, 'selector must contain _id')

		const segments = Segments.find(selector).fetch()
		const rundownIds = _.uniq(_.map(segments, s => s.rundownId))

		const access = allowAccessToRundown(cred, { $in: rundownIds })
		if (!access.read) return logNotAllowed('Segments', access.reason)

		return true
	}
	export function pieces (selector: MongoQuery<{ rundownId: RundownId }>, cred: Credentials): boolean {
		check(selector, Object)
		if (!Settings.enableUserAccounts) return true
		if (!selector.rundownId) throw new Meteor.Error(400, 'selector must contain rundownId')

		const access = allowAccessToRundown(cred, selector.rundownId)
		if (!access.read) return logNotAllowed('Piece', access.reason)

		return true
	}
	export function expectedMediaItems (selector: Mongo.Query<ExpectedMediaItem> | any, cred: Credentials) {
		check(selector, Object)
		if (selector.mediaFlowId) {
			check(selector.mediaFlowId, Object)
			check(selector.mediaFlowId.$in, Array)
		}
		if (!rundownContent(selector, cred)) return null

		let mediaManagerDevice = PeripheralDevices.findOne({
			type: PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER,
			token: cred.token
		})

		if (!mediaManagerDevice) return false

		mediaManagerDevice.studioId = getStudioIdFromDevice(mediaManagerDevice)

		if (mediaManagerDevice && cred.token) {

			// mediaManagerDevice.settings

			return mediaManagerDevice
		} else {

			// TODO: implement access logic here
			// use context.userId

			// just returning true for now
			return true
		}
	}
	export function expectedPlayoutItems (selector: Mongo.Query<ExpectedPlayoutItem> | any, cred: Credentials) {
		check(selector, Object)
		check(selector.studioId, String)

		if (!rundownContent(selector, cred)) return null

		let playoutDevice = PeripheralDevices.findOne({
			type: PeripheralDeviceAPI.DeviceType.PLAYOUT,
			token: cred.token
		})
		if (!playoutDevice) return false

		playoutDevice.studioId = getStudioIdFromDevice(playoutDevice)

		if (playoutDevice && cred.token) {
			return playoutDevice
		} else {
			// TODO: implement access logic here
			// just returning true for now
			return true
		}
	}
}

function rundownContentAllowWrite (userId, doc: RundownContent): boolean {
	const access = allowAccessToRundown({ userId: protectString(userId) }, doc.rundownId)
	if (!access.update) return logNotAllowed('Rundown content', access.reason)
	return true
}
// function segmentAllowWrite (userId, doc: DBSegment): boolean {
// 	const access = allowAccessToRundown({ userId: protectString(userId) }, doc.rundownId)
// 	if (!access.update) return logNotAllowed('Segments', access.reason)
// 	return true
// }
// function partAllowWrite (userId, doc: DBPart | DBPartInstance): boolean {
// 	const access = allowAccessToRundown({ userId: protectString(userId) }, doc.rundownId)
// 	if (!access.update) return logNotAllowed('Parts', access.reason)
// 	return true
// }
// function pieceAllowWrite (userId, doc: PieceGeneric | PieceInstance): boolean {
// 	const access = allowAccessToRundown({ userId: protectString(userId) }, doc.rundownId)
// 	if (!access.update) return logNotAllowed('Piece', access.reason)
// 	return true
// }


Rundowns.allow({
	insert (): boolean {
		return false
	},
	update () {
		// return true // tmp!
		return false
	},
	remove () {
		return false
	}
})

// ----------------------------------------------------------------------------
// Rundown content:
// ----------------------------------------------------------------------------

// Collections security set up:

Segments.allow({
	insert (userId, doc): boolean {
		return rundownContentAllowWrite(userId, doc)
	},
	update (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	},
	remove (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	}
})


Parts.allow({
	insert (userId, doc): boolean {
		return rundownContentAllowWrite(userId, doc)
	},
	update (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	},
	remove (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	}
})
PartInstances.allow({
	insert (userId, doc): boolean {
		return rundownContentAllowWrite(userId, doc)
	},
	update (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	},
	remove (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	}
})
Pieces.allow({
	insert (userId, doc): boolean {
		return rundownContentAllowWrite(userId, doc)
	},
	update (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	},
	remove (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	}
})
PieceInstances.allow({
	insert (userId, doc: PieceInstance): boolean {
		return rundownContentAllowWrite(userId, doc)
	},
	update (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	},
	remove (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	}
})
AdLibPieces.allow({
	insert (userId, doc): boolean {
		return rundownContentAllowWrite(userId, doc)
	},
	update (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	},
	remove (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	}
})
RundownBaselineAdLibPieces.allow({
	insert (userId, doc: RundownBaselineAdLibItem): boolean {
		return rundownContentAllowWrite(userId, doc)
	},
	update (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	},
	remove (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	}
})
IngestDataCache.allow({
	insert (userId, doc: IngestDataCacheObj): boolean {
		return rundownContentAllowWrite(userId, doc)
	},
	update (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	},
	remove (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	}
})
AsRunLog.allow({
	insert (userId, doc: AsRunLogEvent): boolean {
		return rundownContentAllowWrite(userId, doc)
	},
	update (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	},
	remove (userId, doc) {
		return rundownContentAllowWrite(userId, doc)
	}
})

ExpectedMediaItems.allow({
	insert (): boolean {
		return false
	},

	update () {
		return false
	},

	remove () {
		return false
	}
})

ExpectedPlayoutItems.allow({
	insert (): boolean {
		return false
	},

	update () {
		return false
	},

	remove () {
		return false
	}
})

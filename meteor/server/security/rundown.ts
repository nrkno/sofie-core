import { Meteor } from 'meteor/meteor'
import { check } from '../../lib/check'
import { Mongo } from 'meteor/mongo'
import * as _ from 'underscore'
import { MongoQueryKey } from '../../lib/typings/meteor'
import { Credentials, ResolvedCredentials } from './lib/credentials'
import { logNotAllowed } from './lib/lib'
import { allowAccessToRundown } from './lib/security'
import { DBSegment } from '../../lib/collections/Segments'
import { ExpectedMediaItem } from '../../lib/collections/ExpectedMediaItems'
import { PeripheralDeviceType, PeripheralDevice } from '../../lib/collections/PeripheralDevices'
import { ExpectedPlayoutItem } from '../../lib/collections/ExpectedPlayoutItems'
import { Settings } from '../../lib/Settings'
import { RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevices, Segments } from '../collections'
import { getStudioIdFromDevice } from '../api/studio/lib'

export namespace RundownReadAccess {
	/** Check for read access to the rundown collection */
	export async function rundown(
		rundownId: MongoQueryKey<RundownId>,
		cred: Credentials | ResolvedCredentials
	): Promise<boolean> {
		return rundownContent(rundownId, cred)
	}
	/** Check for read access for all rundown content (segments, parts, pieces etc..) */
	export async function rundownContent(
		rundownId: MongoQueryKey<RundownId> | undefined,
		cred: Credentials | ResolvedCredentials
	): Promise<boolean> {
		if (!Settings.enableUserAccounts) return true
		if (!rundownId) throw new Meteor.Error(400, 'selector must contain rundownId')

		const access = await allowAccessToRundown(cred, rundownId)
		if (!access.read) return logNotAllowed('Rundown content', access.reason)

		return true
	}
	/** Check for read access for segments in a rundown */
	export async function segments(segmentId: MongoQueryKey<SegmentId>, cred: Credentials): Promise<boolean> {
		if (!Settings.enableUserAccounts) return true
		if (!segmentId) throw new Meteor.Error(400, 'selector must contain _id')

		const segments = (await Segments.findFetchAsync(segmentId, {
			fields: {
				_id: 1,
				rundownId: 1,
			},
		})) as Array<Pick<DBSegment, '_id' | 'rundownId'>>
		const rundownIds = _.uniq(_.map(segments, (s) => s.rundownId))

		const access = await allowAccessToRundown(cred, { $in: rundownIds })
		if (!access.read) return logNotAllowed('Segments', access.reason)

		return true
	}
	/** Check for read access for pieces in a rundown */
	export async function pieces(rundownId: MongoQueryKey<RundownId>, cred: Credentials): Promise<boolean> {
		if (!Settings.enableUserAccounts) return true
		if (!rundownId) throw new Meteor.Error(400, 'selector must contain rundownId')

		const access = await allowAccessToRundown(cred, rundownId)
		if (!access.read) return logNotAllowed('Piece', access.reason)

		return true
	}
	/** Check for read access for exoected media items in a rundown */
	export async function expectedMediaItems(
		selector: Mongo.Query<ExpectedMediaItem> | any,
		cred: Credentials
	): Promise<PeripheralDevice | null | boolean> {
		check(selector, Object)
		if (selector.mediaFlowId) {
			check(selector.mediaFlowId, Object)
			check(selector.mediaFlowId.$in, Array)
		}
		if (!(await rundownContent(selector.rundownId, cred))) return null

		const mediaManagerDevice = await PeripheralDevices.findOneAsync({
			type: PeripheralDeviceType.MEDIA_MANAGER,
			token: cred.token,
		})

		if (!mediaManagerDevice) return false

		mediaManagerDevice.studioId = await getStudioIdFromDevice(mediaManagerDevice)

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

	/** Check for read access to expectedPlayoutItems */
	export async function expectedPlayoutItems(
		selector: Mongo.Query<ExpectedPlayoutItem> | any,
		cred: Credentials
	): Promise<PeripheralDevice | null | boolean> {
		check(selector, Object)
		check(selector.studioId, String)

		if (!(await rundownContent(selector.rundownId, cred))) return null

		const playoutDevice = await PeripheralDevices.findOneAsync({
			type: PeripheralDeviceType.PLAYOUT,
			token: cred.token,
		})
		if (!playoutDevice) return false

		playoutDevice.studioId = await getStudioIdFromDevice(playoutDevice)

		if (playoutDevice && cred.token) {
			return playoutDevice
		} else {
			// TODO: implement access logic here
			// just returning true for now
			return true
		}
	}
}

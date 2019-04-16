import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import * as _ from 'underscore'
import * as MOS from 'mos-connection'

import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import {
	Rundown,
	Rundowns,
	DBRundown
} from '../../../lib/collections/Rundowns'
import { Parts } from '../../../lib/collections/Parts'
import { Piece } from '../../../lib/collections/Pieces'
import { PeripheralDeviceSecurity } from '../../security/peripheralDevices'
import { logger } from '../../logging'
import { Studio } from '../../../lib/collections/Studios'
import { setMeteorMethods, Methods } from '../../methods'
import { getStudioFromDevice, updateDeviceLastDataReceived, getRundown, canBeUpdated } from '../ingest/lib'
import { handleRemovedRundown } from '../ingest/rundownInput'
import { getMosRundownId, getMosPartId } from '../ingest/mosDevice/lib'
import { handleMosRundownData, handleMosFullStory, handleMosDeleteStory, handleInsertParts, handleSwapStories, handleMoveStories } from '../ingest/mosDevice/ingest'

/**
 * Returns a Rundown, throws error if not found
 * @param rundownId Id of the Rundown
 */
function getRO (studio: Studio, rundownID: MOS.MosString128): Rundown {
	return getRundown(getMosRundownId(studio, rundownID))
}

function formatDuration (duration: any): number | undefined {
	try {
		// first try and parse it as a MOS.MosDuration timecode string
		return duration ? new MOS.MosDuration(duration.toString()).valueOf() * 1000 : undefined
	} catch (e) {
		try {
			// second try and parse it as a length in seconds
			return duration ? Number.parseFloat(duration) * 1000 : undefined
		} catch (e2) {
			logger.warn('Bad MOS.MosDuration: "' + duration + '"', e)
			return undefined
		}
	}
}
function formatTime (time: any): number | undefined {
	try {
		return time ? new MOS.MosTime(time.toString()).getTime() : undefined
	} catch (e) {
		logger.warn('Bad MOS.MosTime: "' + time + '"', e)
		return undefined
	}
}

export function replaceStoryItem (rundown: Rundown, piece: Piece, partCache: {}, inPoint: number, duration: number) {
	return new Promise((resolve, reject) => {
		const story = partCache.data.Body.filter(item => item.Type === 'storyItem' && item.Content.ID === piece.externalId)[0].Content
		story.EditorialStart = inPoint
		story.EditorialDuration = duration

		const peripheralDevice = PeripheralDevices.findOne(rundown.peripheralDeviceId)
		if (!peripheralDevice) throw new Meteor.Error(404, 'PeripheralDevice "' + rundown.peripheralDeviceId + '" not found' )

		PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err?: any) => {
			if (err) reject(err)
			else resolve()
		}, 'replaceStoryItem', partCache.data.RundownId, partCache.data.ID, story)
	})
}

function isAvailableForMOS (rundown: Rundown | undefined): boolean {
	if (rundown && rundown.unsynced) {
		logger.info(`Rundown "${rundown._id}" has been unsynced and needs to be synced before it can be updated.`)
		return false
	}
	return true
}
export namespace MosIntegration {
	export function mosRoCreate (id: string, token: string, rundown: MOS.IMOSRunningOrder) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoCreate ' + rundown.ID)
		logger.debug(rundown)

		handleMosRundownData(rundown, peripheralDevice, true)
	}
	export function mosRoReplace (id: string, token: string, rundown: MOS.IMOSRunningOrder) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoReplace ' + rundown.ID)
		// @ts-ignore
		logger.debug(rundown)
		handleMosRundownData(rundown, peripheralDevice, true)
	}
	export function mosRoDelete (id: string, token: string, rundownId: MOS.MosString128, force?: boolean) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoDelete ' + rundownId)
		handleRemovedRundown(peripheralDevice, rundownId.toString())
	}
	export function mosRoMetadata (id: string, token: string, rundownData: MOS.IMOSRunningOrderBase) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoMetadata ' + rundownData.ID)

		const studio = getStudioFromDevice(peripheralDevice)

		// @ts-ignore
		logger.debug(rundownData)
		let rundown = getRO(studio, rundownData.ID)
		if (!isAvailableForMOS(rundown)) return
		updateDeviceLastDataReceived(peripheralDevice._id)

		let m: Partial<DBRundown> = {}
		if (rundownData.MosExternalMetaData) m.metaData = rundownData.MosExternalMetaData
		if (rundownData.Slug) 				m.name = rundownData.Slug.toString()
		if (rundownData.EditorialStart) 		m.expectedStart = formatTime(rundownData.EditorialStart)
		if (rundownData.EditorialDuration) 	m.expectedDuration = formatDuration(rundownData.EditorialDuration)

		if (!_.isEmpty(m)) {
			Rundowns.update(rundown._id, {$set: m})
			// update data cache:
			const cache = rundown.fetchCache(CachePrefix.INGEST_RUNDOWN + rundownId(rundownData.ID),)
			if (cache) {
				if (!cache.MosExternalMetaData) {
					cache.MosExternalMetaData = []
				}
				_.each(rundownData.MosExternalMetaData || [], (md, key) => {
					if (!cache.MosExternalMetaData[key]) {
						cache.MosExternalMetaData[key] = md
					}
					let md0 = cache.MosExternalMetaData[key]

					md0.MosPayload = _.extend(
						md0.MosPayload || {},
						md.MosPayload
					)
				})
			}

			rundown.saveCache(CachePrefix.INGEST_RUNDOWN + rundownId(rundownData.ID), cache)
		}
	}
	export function mosRoStatus (id: string, token: string, status: MOS.IMOSRunningOrderStatus) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStatus ' + status.ID)
		logger.debug(status)

		const studio = getStudioFromDevice(peripheralDevice)
		const rundown = getRundown(getMosRundownId(studio, status.ID))
		if (!canBeUpdated(rundown)) return

		updateDeviceLastDataReceived(peripheralDevice._id)

		Rundowns.update(rundown._id, {$set: {
			status: status.Status
		}})
	}
	export function mosRoStoryStatus (id: string, token: string, status: MOS.IMOSStoryStatus) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryStatus ' + status.ID)
		logger.debug(status)

		const studio = getStudioFromDevice(peripheralDevice)
		const rundown = getRundown(getMosRundownId(studio, status.ID))
		if (!canBeUpdated(rundown)) return

		updateDeviceLastDataReceived(peripheralDevice._id)

		// Save Stories (aka Part ) status into database:
		const part = Parts.findOne({
			_id: getMosPartId(rundown._id, status.ID),
			rundownId: rundown._id
		})
		if (part) {
			Parts.update(part._id, {$set: {
				status: status.Status
			}})
		} else throw new Meteor.Error(404, 'Segment ' + status.ID + ' in rundown ' + status.RunningOrderId + ' not found')
	}
	export function mosRoStoryInsert (id: string, token: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryInsert after ' + Action.StoryID)
		// @ts-ignore
		logger.debug(Action, Stories)

		handleInsertParts(peripheralDevice, Action.RunningOrderID, Action.StoryID, false, Stories)

		// TODO - update next

		// const studio = getStudioFromDevice(peripheralDevice)

		// let rundown = getRO(studio, Action.RunningOrderID)
		// if (!isAvailableForMOS(rundown)) return
		// updateDeviceLastDataReceived(peripheralDevice._id)

		// // @ts-ignore		logger.debug(
		// logger.debug(Action, Stories)
		// // insert a story (aka Part) before another story:
		// let partAfter = (Action.StoryID ? getPart(studio, Action.RunningOrderID, Action.StoryID) : null)

		// // let newRankMax
		// // let newRankMin
		// let partBeforeOrLast: DBPart | undefined = (
		// 	partAfter ?
		// 		fetchBefore(Parts,
		// 			{ rundownId: rundown._id },
		// 			partAfter._rank
		// 		) :
		// 		fetchBefore(Parts,
		// 			{ rundownId: rundown._id },
		// 			null
		// 		)
		// )
		// let affectedPartIds: Array<string> = []
		// let firstInsertedPart: DBPart | undefined
		// _.each(Stories, (story: MOS.IMOSROStory, i: number) => {
		// 	logger.info('insert story ' + story.ID)
		// 	let rank = getRank(partBeforeOrLast, partAfter, i, Stories.length)
		// 	// let rank = newRankMin + ( i / Stories.length ) * (newRankMax - newRankMin)
		// 	let part = upsertPart(story, rundown._id, rank)
		// 	affectedPartIds.push(part._id)
		// 	if (!firstInsertedPart) firstInsertedPart = part
		// })

		// if (partAfter && rundown.nextPartId === partAfter._id && firstInsertedPart && !rundown.nextPartManual) {
		// 	// Move up next-point to the first inserted part
		// 	ServerPlayoutAPI.rundownSetNext(rundown._id, firstInsertedPart._id)
		// }

		// updateSegments(rundown._id)
		// updateAffectedParts(rundown, affectedPartIds)
	}
	export function mosRoStoryReplace (id: string, token: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryReplace ' + Action.StoryID)
		// @ts-ignore
		logger.debug(Action, Stories)

		// TODO - test
		handleInsertParts(peripheralDevice, Action.RunningOrderID, Action.StoryID, true, Stories)

		// TODO - update next

		// const studio = getStudioFromDevice(peripheralDevice)

		// let rundown = getRO(studio, Action.RunningOrderID)
		// if (!isAvailableForMOS(rundown)) return
		// updateDeviceLastDataReceived(peripheralDevice._id)
		// // @ts-ignore
		// logger.debug(Action, Stories)
		// // Replace a Story (aka a Part) with one or more Stories
		// let partToReplace = getPart(studio, Action.RunningOrderID, Action.StoryID)

		// let partBefore = fetchBefore(Parts, { rundownId: rundown._id }, partToReplace._rank)
		// let partAfter = fetchAfter(Parts, { rundownId: rundown._id }, partToReplace._rank)

		// let affectedPartIds: Array<string> = []

		// let insertedPartIds: {[id: string]: boolean} = {}
		// let firstInsertedPart: DBPart | undefined
		// _.each(Stories, (story: MOS.IMOSROStory, i: number) => {
		// 	logger.info('insert story ' + story.ID)
		// 	let rank = getRank(partBefore, partAfter, i, Stories.length)
		// 	let part = upsertPart(story, rundown._id, rank)
		// 	insertedPartIds[part._id] = true
		// 	affectedPartIds.push(part._id)
		// 	if (!firstInsertedPart) firstInsertedPart = part

		// })

		// updateSegments(rundown._id)

		// if (!insertedPartIds[partToReplace._id]) {
		// 	// ok, the part to replace wasn't in the inserted parts
		// 	// remove it then:
		// 	affectedPartIds.push(partToReplace._id)
		// 	removePart(rundown._id, partToReplace, firstInsertedPart)
		// }

		// updateAffectedParts(rundown, affectedPartIds)
	}
	export function mosRoStoryMove (id: string, token: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.MosString128>) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn ('mosRoStoryMove ' + Action.StoryID)

		handleMoveStories(peripheralDevice, Action.RunningOrderID, Action.StoryID, Stories)

		// TODO - update next etc


		// // Move Stories (aka Part ## TODO ##Lines) to before a story

		// let currentPart: Part | undefined = undefined
		// let onAirNextWindowWidth: number | undefined = undefined
		// let nextPosition: number | undefined = undefined
		// if (rundown.currentPartId) {
		// 	let nextPart: Part | undefined = undefined
		// 	currentPart = Parts.findOne(rundown.currentPartId)
		// 	if (rundown.nextPartId) nextPart = Parts.findOne(rundown.nextPartId)
		// 	if (currentPart) {
		// 		const parts = rundown.getParts({
		// 			_rank: _.extend({
		// 				$gte: currentPart._rank
		// 			}, nextPart ? {
		// 				$lte: nextPart._rank
		// 			} : {})
		// 		})
		// 		onAirNextWindowWidth = parts.length
		// 	}
		// } else if (rundown.nextPartId) {
		// 	let nextPart: Part | undefined = undefined
		// 	nextPart = Parts.findOne(rundown.nextPartId)
		// 	if (nextPart) {
		// 		const parts = rundown.getParts({
		// 			_rank: {
		// 				$lte: nextPart._rank
		// 			}
		// 		})
		// 		nextPosition = parts.length
		// 	}
		// }

		// let partAfter = (Action.StoryID ? getPart(studio, Action.RunningOrderID, Action.StoryID) : null)
		// let partBefore = fetchBefore(Parts, { rundownId: rundown._id }, (partAfter ? partAfter._rank : null))

		// // console.log('Inserting between: ' + (partBefore ? partBefore._rank : 'X') + ' - ' + partAfter._rank)

		// let affectedPartIds: Array<string> = []
		// if (partAfter) affectedPartIds.push(partAfter._id)
		// if (partBefore) affectedPartIds.push(partBefore._id)
		// _.each(Stories, (storyId: MOS.MosString128, i: number) => {
		// 	let rank = getRank(partBefore, partAfter, i, Stories.length)
		// 	Parts.update(getMosPartId(rundown._id, storyId), {$set: {
		// 		_rank: rank
		// 	}})
		// })

		// updateSegments(rundown._id)
		// updateAffectedParts(rundown, affectedPartIds)

		// // Meteor.call('playout_storiesMoved', rundown._id, onAirNextWindowWidth, nextPosition)
		// ServerPlayoutAPI.rundownStoriesMoved(rundown._id, onAirNextWindowWidth, nextPosition)
	}
	export function mosRoStoryDelete (id: string, token: string, Action: MOS.IMOSROAction, Stories: Array<MOS.MosString128>) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryDelete ' + Action.RunningOrderID)

		handleMosDeleteStory(peripheralDevice, Action.RunningOrderID, Stories)

		// TODO - update next
	}
	export function mosRoStorySwap (id: string, token: string, Action: MOS.IMOSROAction, StoryID0: MOS.MosString128, StoryID1: MOS.MosString128) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStorySwap ' + StoryID0 + ', ' + StoryID1)

		// TODO - test
		handleSwapStories(peripheralDevice, Action.RunningOrderID, StoryID0, StoryID1)

		// TODO - update next

		// const studio = getStudioFromDevice(peripheralDevice)

		// let rundown = getRO(studio, Action.RunningOrderID)
		// if (!isAvailableForMOS(rundown)) return
		// updateDeviceLastDataReceived(peripheralDevice._id)
		// // @ts-ignore
		// logger.debug(Action, StoryID0, StoryID1)
		// // Swap Stories (aka Part)

		// let part0 = getPart(studio, Action.RunningOrderID, StoryID0)
		// let part1 = getPart(studio, Action.RunningOrderID, StoryID1)

		// Parts.update(part0._id, {$set: {_rank: part1._rank}})
		// Parts.update(part1._id, {$set: {_rank: part0._rank}})

		// if (rundown.nextPartId === part0._id) {
		// 	// Change nexted part
		// 	ServerPlayoutAPI.rundownSetNext(rundown._id, part1._id)
		// } else if (rundown.nextPartId === part1._id) {
		// 	// Change nexted part
		// 	ServerPlayoutAPI.rundownSetNext(rundown._id, part0._id)
		// }

		// updateSegments(rundown._id)
		// updateAffectedParts(rundown, [part0._id, part1._id])
	}
	export function mosRoReadyToAir (id: string, token: string, Action: MOS.IMOSROReadyToAir) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoReadyToAir ' + Action.ID)
		logger.debug(Action)

		const studio = getStudioFromDevice(peripheralDevice)
		const rundown = getRundown(getMosRundownId(studio, status.ID))
		if (!canBeUpdated(rundown)) return

		updateDeviceLastDataReceived(peripheralDevice._id)

		// Set the ready to air status of a Rundown
		Rundowns.update(rundown._id, {$set: {
			airStatus: Action.Status
		}})
	}
	export function mosRoFullStory (id: string, token: string, story: MOS.IMOSROFullStory) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoFullStory ' + story.ID)

		handleMosFullStory(peripheralDevice, story)
	}

	/**
	 * Unimplemented item methods.
	 * An item is an object within a Part. These do not directly map to a Piece
	 */
	export function mosRoItemDelete (id: string, token: string, Action: MOS.IMOSStoryAction, Items: Array<MOS.MosString128>) {
		PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemDelete NOT IMPLEMENTED YET ' + Action.StoryID)
		// @ts-ignore
		logger.debug(Action, Items)
	}
	export function mosRoItemStatus (id: string, token: string, status: MOS.IMOSItemStatus) {
		PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemStatus NOT IMPLEMENTED YET ' + status.ID)
		// @ts-ignore
		logger.debug(status)
	}
	export function mosRoItemInsert (id: string, token: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) {
		PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemInsert NOT SUPPORTED after ' + Action.ItemID)
		// @ts-ignore
		logger.debug(Action, Items)
	}
	export function mosRoItemReplace (id: string, token: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) {
		PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemReplace NOT IMPLEMENTED YET ' + Action.ItemID)
		// @ts-ignore
		logger.debug(Action, Items)
	}
	export function mosRoItemMove (id: string, token: string, Action: MOS.IMOSItemAction, Items: Array<MOS.MosString128>) {
		PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemMove NOT IMPLEMENTED YET ' + Action.ItemID)
		// @ts-ignore
		logger.debug(Action, Items)
	}
	export function mosRoItemSwap (id: string, token: string, Action: MOS.IMOSStoryAction, ItemID0: MOS.MosString128, ItemID1: MOS.MosString128) {
		PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemSwap NOT IMPLEMENTED YET ' + ItemID0 + ', ' + ItemID1)
		// @ts-ignore
		logger.debug(Action, ItemID0, ItemID1)
	}
}

let methods: Methods = {}
methods[PeripheralDeviceAPI.methods.mosRoCreate] = (deviceId: string, deviceToken: string, rundown: MOS.IMOSRunningOrder) => {
	return MosIntegration.mosRoCreate(deviceId, deviceToken, rundown)
}
methods[PeripheralDeviceAPI.methods.mosRoReplace] = (deviceId: string, deviceToken: string, rundown: MOS.IMOSRunningOrder) => {
	return MosIntegration.mosRoReplace(deviceId, deviceToken, rundown)
}
methods[PeripheralDeviceAPI.methods.mosRoDelete] = (deviceId: string, deviceToken: string, rundownId: MOS.MosString128, force?: boolean) => {
	return MosIntegration.mosRoDelete(deviceId, deviceToken, rundownId, force)
}
methods[PeripheralDeviceAPI.methods.mosRoMetadata] = (deviceId: string, deviceToken: string, metadata: MOS.IMOSRunningOrderBase) => {
	return MosIntegration.mosRoMetadata(deviceId, deviceToken, metadata)
}
methods[PeripheralDeviceAPI.methods.mosRoStatus] = (deviceId: string, deviceToken: string, status: MOS.IMOSRunningOrderStatus) => {
	return MosIntegration.mosRoStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryStatus] = (deviceId: string, deviceToken: string, status: MOS.IMOSStoryStatus) => {
	return MosIntegration.mosRoStoryStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRoItemStatus] = (deviceId: string, deviceToken: string, status: MOS.IMOSItemStatus) => {
	return MosIntegration.mosRoItemStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryInsert] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) => {
	return MosIntegration.mosRoStoryInsert(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemInsert] = (deviceId: string, deviceToken: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) => {
	return MosIntegration.mosRoItemInsert(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryReplace] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) => {
	return MosIntegration.mosRoStoryReplace(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemReplace] = (deviceId: string, deviceToken: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) => {
	return MosIntegration.mosRoItemReplace(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryMove] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.MosString128>) => {
	return MosIntegration.mosRoStoryMove(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemMove] = (deviceId: string, deviceToken: string, Action: MOS.IMOSItemAction, Items: Array<MOS.MosString128>) => {
	return MosIntegration.mosRoItemMove(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryDelete] = (deviceId: string, deviceToken: string, Action: MOS.IMOSROAction, Stories: Array<MOS.MosString128>) => {
	return MosIntegration.mosRoStoryDelete(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemDelete] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, Items: Array<MOS.MosString128>) => {
	return MosIntegration.mosRoItemDelete(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStorySwap] = (deviceId: string, deviceToken: string, Action: MOS.IMOSROAction, StoryID0: MOS.MosString128, StoryID1: MOS.MosString128) => {
	return MosIntegration.mosRoStorySwap(deviceId, deviceToken, Action, StoryID0, StoryID1)
}
methods[PeripheralDeviceAPI.methods.mosRoItemSwap] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, ItemID0: MOS.MosString128, ItemID1: MOS.MosString128) => {
	return MosIntegration.mosRoItemSwap(deviceId, deviceToken, Action, ItemID0, ItemID1)
}
methods[PeripheralDeviceAPI.methods.mosRoReadyToAir] = (deviceId: string, deviceToken: string, Action: MOS.IMOSROReadyToAir) => {
	return MosIntegration.mosRoReadyToAir(deviceId, deviceToken, Action)
}
methods[PeripheralDeviceAPI.methods.mosRoFullStory] = (deviceId: string, deviceToken: string, story: MOS.IMOSROFullStory) => {
	return MosIntegration.mosRoFullStory(deviceId, deviceToken, story)
}
// Apply methods:
setMeteorMethods(methods)

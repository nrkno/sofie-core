import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import * as MOS from 'mos-connection'

import { Rundowns } from '../../../../lib/collections/Rundowns'
import { Parts } from '../../../../lib/collections/Parts'
import { PeripheralDeviceSecurity } from '../../../security/peripheralDevices'
import { logger } from '../../../logging'
import { getStudioFromDevice, canBeUpdated } from '../lib'
import { handleRemovedRundown } from '../rundownInput'
import { getPartIdFromMosStory, getRundownFromMosRO } from './lib'
import { handleMosRundownData, handleMosFullStory, handleMosDeleteStory, handleInsertParts, handleSwapStories, handleMoveStories, handleMosRundownMetadata } from './ingest'

export namespace MosIntegration {
	export function mosRoCreate (id: string, token: string, rundown: MOS.IMOSRunningOrder) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoCreate ' + rundown.ID)
		logger.debug(rundown)

		handleMosRundownData(peripheralDevice, rundown, true)
	}
	export function mosRoReplace (id: string, token: string, rundown: MOS.IMOSRunningOrder) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoReplace ' + rundown.ID)
		// @ts-ignore
		logger.debug(rundown)
		handleMosRundownData(peripheralDevice, rundown, true)
	}
	export function mosRoDelete (id: string, token: string, rundownId: MOS.MosString128, force?: boolean) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoDelete ' + rundownId)
		handleRemovedRundown(peripheralDevice, rundownId.toString())
	}
	export function mosRoMetadata (id: string, token: string, rundownData: MOS.IMOSRunningOrderBase) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoMetadata ' + rundownData.ID)
		logger.debug(rundownData)

		handleMosRundownMetadata(peripheralDevice, rundownData)
	}
	export function mosRoStatus (id: string, token: string, status: MOS.IMOSRunningOrderStatus) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStatus ' + status.ID)
		logger.debug(status)

		const studio = getStudioFromDevice(peripheralDevice)
		const rundown = getRundownFromMosRO(studio, status.ID)
		if (!canBeUpdated(rundown)) return

		Rundowns.update(rundown._id, {$set: {
			status: status.Status
		}})
	}
	export function mosRoStoryStatus (id: string, token: string, status: MOS.IMOSStoryStatus) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryStatus ' + status.ID)
		logger.debug(status)

		const studio = getStudioFromDevice(peripheralDevice)
		const rundown = getRundownFromMosRO(studio, status.RunningOrderId)
		if (!canBeUpdated(rundown)) return

		// Save Stories (aka Part ) status into database:
		const part = Parts.findOne({
			_id: getPartIdFromMosStory(rundown._id, status.ID),
			rundownId: rundown._id
		})
		if (part) {
			Parts.update(part._id, {$set: {
				status: status.Status
			}})
		} else throw new Meteor.Error(404, 'Part ' + status.ID + ' in rundown ' + status.RunningOrderId + ' not found')
	}
	export function mosRoStoryInsert (id: string, token: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryInsert after ' + Action.StoryID)
		// @ts-ignore
		logger.debug(Action, Stories)

		handleInsertParts(peripheralDevice, Action.RunningOrderID, Action.StoryID, false, Stories)
	}
	export function mosRoStoryReplace (id: string, token: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryReplace ' + Action.StoryID)
		// @ts-ignore
		logger.debug(Action, Stories)

		handleInsertParts(peripheralDevice, Action.RunningOrderID, Action.StoryID, true, Stories)
	}
	export function mosRoStoryMove (id: string, token: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.MosString128>) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoStoryMove ' + Action.StoryID)

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
	}
	export function mosRoStorySwap (id: string, token: string, Action: MOS.IMOSROAction, StoryID0: MOS.MosString128, StoryID1: MOS.MosString128) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStorySwap ' + StoryID0 + ', ' + StoryID1)

		// TODO - test
		handleSwapStories(peripheralDevice, Action.RunningOrderID, StoryID0, StoryID1)
	}
	export function mosRoReadyToAir (id: string, token: string, Action: MOS.IMOSROReadyToAir) {
		const peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoReadyToAir ' + Action.ID)
		logger.debug(Action)

		const studio = getStudioFromDevice(peripheralDevice)
		const rundown = getRundownFromMosRO(studio, Action.ID)
		if (!canBeUpdated(rundown)) return

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
		logger.warn('mosRoItemDelete NOT SUPPORTED ' + Action.StoryID)
		// @ts-ignore
		logger.debug(Action, Items)
	}
	export function mosRoItemStatus (id: string, token: string, status: MOS.IMOSItemStatus) {
		PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemStatus NOT SUPPORTED ' + status.ID)
		// @ts-ignore
		logger.debug(status)
	}
	export function mosRoItemInsert (id: string, token: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) {
		PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemInsert NOT SUPPORTED ' + Action.ItemID)
		// @ts-ignore
		logger.debug(Action, Items)
	}
	export function mosRoItemReplace (id: string, token: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) {
		PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemReplace NOT SUPPORTED ' + Action.ItemID)
		// @ts-ignore
		logger.debug(Action, Items)
	}
	export function mosRoItemMove (id: string, token: string, Action: MOS.IMOSItemAction, Items: Array<MOS.MosString128>) {
		PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemMove NOT SUPPORTED ' + Action.ItemID)
		// @ts-ignore
		logger.debug(Action, Items)
	}
	export function mosRoItemSwap (id: string, token: string, Action: MOS.IMOSStoryAction, ItemID0: MOS.MosString128, ItemID1: MOS.MosString128) {
		PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemSwap NOT SUPPORTED ' + ItemID0 + ', ' + ItemID1)
		// @ts-ignore
		logger.debug(Action, ItemID0, ItemID1)
	}
}

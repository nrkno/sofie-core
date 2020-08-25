import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import * as MOS from 'mos-connection'

import { Rundowns } from '../../../../lib/collections/Rundowns'
import { Parts } from '../../../../lib/collections/Parts'
import { PeripheralDeviceContentWriteAccess } from '../../../security/peripheralDevice'
import { logger } from '../../../logging'
import { getStudioFromDevice, canBeUpdated, checkAccessAndGetPeripheralDevice } from '../lib'
import { handleRemovedRundown, regenerateRundown } from '../rundownInput'
import { getPartIdFromMosStory, getRundownFromMosRO, parseMosString } from './lib'
import {
	handleMosRundownData,
	handleMosFullStory,
	handleMosDeleteStory,
	handleInsertParts,
	handleSwapStories,
	handleMoveStories,
	handleMosRundownMetadata,
} from './ingest'
import { PartInstances } from '../../../../lib/collections/PartInstances'
import { PeripheralDeviceId, PeripheralDevices } from '../../../../lib/collections/PeripheralDevices'
import { MethodContext } from '../../../../lib/api/methods'
import Agent from 'meteor/kschingiz:meteor-elastic-apm'

function traceFunction(description: string, fn: (...args: any[]) => void, ...args: any[]) {
	const transaction = Agent.startTransaction(description, 'mosIntegration')
	const res = fn(...args)
	if (transaction) transaction.end()
	return res
}

const fns: { [key: string]: (...args: any[]) => void } = {
	mosRoCreate: function mosRoCreate(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		rundown: MOS.IMOSRunningOrder
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(id, token, context)

		logger.info(`mosRoCreate "${rundown.ID}"`)
		logger.debug(rundown)

		handleMosRundownData(peripheralDevice, rundown, true)
	},
	mosRoReplace: function mosRoReplace(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		rundown: MOS.IMOSRunningOrder
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(id, token, context)

		logger.info(`mosRoReplace "${rundown.ID}"`)
		// @ts-ignore
		logger.debug(rundown)
		handleMosRundownData(peripheralDevice, rundown, true)
	},
	mosRoDelete: function mosRoDelete(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		rundownId: MOS.MosString128,
		force?: boolean
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(id, token, context)

		logger.info(`mosRoDelete "${rundownId}"`)
		handleRemovedRundown(peripheralDevice, parseMosString(rundownId))
	},
	mosRoMetadata: function mosRoMetadata(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		rundownData: MOS.IMOSRunningOrderBase
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(id, token, context)

		logger.info(`mosRoMetadata "${rundownData.ID}"`)
		logger.debug(rundownData)

		handleMosRundownMetadata(peripheralDevice, rundownData)
	},
	mosRoStatus: function mosRoStatus(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		status: MOS.IMOSRunningOrderStatus
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(id, token, context)

		logger.info(`mosRoStatus "${status.ID}"`)
		logger.debug(status)

		const studio = getStudioFromDevice(peripheralDevice)
		const rundown = getRundownFromMosRO(studio, status.ID)
		if (!canBeUpdated(rundown)) return

		Rundowns.update(rundown._id, {
			$set: {
				status: status.Status,
			},
		})
	},
	mosRoStoryStatus: function mosRoStoryStatus(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		status: MOS.IMOSStoryStatus
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(id, token, context)

		logger.info(`mosRoStoryStatus "${status.ID}"`)
		logger.debug(status)

		const studio = getStudioFromDevice(peripheralDevice)
		const rundown = getRundownFromMosRO(studio, status.RunningOrderId)
		if (!canBeUpdated(rundown)) return

		// Save Stories (aka Part ) status into database:
		const part = Parts.findOne({
			_id: getPartIdFromMosStory(rundown._id, status.ID),
			rundownId: rundown._id,
		})
		if (part) {
			Parts.update(part._id, {
				$set: {
					status: status.Status,
				},
			})
			// TODO-PartInstance - pending new data flow
			PartInstances.update(
				{
					'part._id': part._id,
					reset: { $ne: true },
				},
				{
					$set: {
						status: status.Status,
					},
				},
				{ multi: true }
			)
		} else throw new Meteor.Error(404, `Part ${status.ID} in rundown ${status.RunningOrderId} not found`)
	},
	mosRoStoryInsert: function mosRoStoryInsert(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.IMOSROStory>
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(id, token, context)

		logger.info(`mosRoStoryInsert after "${Action.StoryID}" Stories: ${Stories}`)
		// @ts-ignore
		logger.debug(Action, Stories)

		handleInsertParts(peripheralDevice, Action.RunningOrderID, Action.StoryID, false, Stories)
	},
	mosRoStoryReplace: function mosRoStoryReplace(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.IMOSROStory>
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(id, token, context)

		logger.info(`mosRoStoryReplace "${Action.StoryID}" Stories: ${Stories}`)
		// @ts-ignore
		logger.debug(Action, Stories)

		handleInsertParts(peripheralDevice, Action.RunningOrderID, Action.StoryID, true, Stories)
	},
	mosRoStoryMove: function mosRoStoryMove(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.MosString128>
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(id, token, context)

		logger.info(`mosRoStoryMove "${Action.StoryID}" Stories: ${Stories}`)

		handleMoveStories(peripheralDevice, Action.RunningOrderID, Action.StoryID, Stories)
	},
	mosRoStoryDelete: function mosRoStoryDelete(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSROAction,
		Stories: Array<MOS.MosString128>
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(id, token, context)

		logger.info(`mosRoStoryDelete "${Action.RunningOrderID}" Stories: ${Stories}`)

		handleMosDeleteStory(peripheralDevice, Action.RunningOrderID, Stories)
	},
	mosRoStorySwap: function mosRoStorySwap(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSROAction,
		StoryID0: MOS.MosString128,
		StoryID1: MOS.MosString128
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(id, token, context)

		logger.info(`mosRoStorySwap "${StoryID0}", "${StoryID1}"`)

		handleSwapStories(peripheralDevice, Action.RunningOrderID, StoryID0, StoryID1)
	},
	mosRoReadyToAir: function mosRoReadyToAir(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSROReadyToAir
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(id, token, context)

		logger.info(`mosRoReadyToAir "${Action.ID}"`)
		logger.debug(Action)

		const studio = getStudioFromDevice(peripheralDevice)
		const rundown = getRundownFromMosRO(studio, Action.ID)
		if (!canBeUpdated(rundown)) return

		// Set the ready to air status of a Rundown
		if (rundown.airStatus !== Action.Status) {
			Rundowns.update(rundown._id, {
				$set: {
					airStatus: Action.Status,
				},
			})
			regenerateRundown(rundown._id)
		}
	},
	mosRoFullStory: function mosRoFullStory(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		story: MOS.IMOSROFullStory
	) {
		const peripheralDevice = checkAccessAndGetPeripheralDevice(id, token, context)

		logger.info(`mosRoFullStory "${story.ID}"`)

		handleMosFullStory(peripheralDevice, story)
	},
	mosRoItemDelete: function mosRoItemDelete(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSStoryAction,
		Items: Array<MOS.MosString128>
	) {
		checkAccessAndGetPeripheralDevice(id, token, context)

		logger.warn(`mosRoItemDelete NOT SUPPORTED "${Action.StoryID}"`)
		// @ts-ignore
		logger.debug(Action, Items)
	},
	mosRoItemStatus: function mosRoItemStatus(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		status: MOS.IMOSItemStatus
	) {
		checkAccessAndGetPeripheralDevice(id, token, context)

		logger.warn(`mosRoItemStatus NOT SUPPORTED "${status.ID}"`)
		// @ts-ignore
		logger.debug(status)
	},
	mosRoItemInsert: function mosRoItemInsert(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.IMOSItem>
	) {
		checkAccessAndGetPeripheralDevice(id, token, context)

		logger.warn(`mosRoItemInsert NOT SUPPORTED "${Action.ItemID}"`)
		// @ts-ignore
		logger.debug(Action, Items)
	},
	mosRoItemReplace: function mosRoItemReplace(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.IMOSItem>
	) {
		checkAccessAndGetPeripheralDevice(id, token, context)

		logger.warn(`mosRoItemReplace NOT SUPPORTED "${Action.ItemID}"`)
		// @ts-ignore
		logger.debug(Action, Items)
	},
	mosRoItemMove: function mosRoItemMove(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.MosString128>
	) {
		checkAccessAndGetPeripheralDevice(id, token, context)

		logger.warn(`mosRoItemMove NOT SUPPORTED "${Action.ItemID}"`)
		// @ts-ignore
		logger.debug(Action, Items)
	},
	mosRoItemSwap: function mosRoItemSwap(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSStoryAction,
		ItemID0: MOS.MosString128,
		ItemID1: MOS.MosString128
	) {
		checkAccessAndGetPeripheralDevice(id, token, context)

		logger.warn(`mosRoItemSwap NOT SUPPORTED "${ItemID0}", "${ItemID1}"`)
		// @ts-ignore
		logger.debug(Action, ItemID0, ItemID1)
	},
}

export namespace MosIntegration {
	export function mosRoCreate(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		rundown: MOS.IMOSRunningOrder
	) {
		return traceFunction('mosRoCreate', fns.mosRoCreate, context, id, token, rundown)
	}

	export function mosRoReplace(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		rundown: MOS.IMOSRunningOrder
	) {
		return traceFunction('mosRoReplace', fns.mosRoReplace, context, id, token, rundown)
	}

	export function mosRoDelete(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		rundownId: MOS.MosString128,
		force?: boolean
	) {
		return traceFunction('mosRoDelete', fns.mosRoDelete, context, id, token, rundownId, force)
	}

	export function mosRoMetadata(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		rundownData: MOS.IMOSRunningOrderBase
	) {
		traceFunction('mosRoMetadata', fns.mosRoMetadata, context, id, token, rundownData)
	}

	export function mosRoStatus(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		status: MOS.IMOSRunningOrderStatus
	) {
		traceFunction('mosRoStatus', fns.mosRoStatus, context, id, token, status)
	}

	export function mosRoStoryStatus(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		status: MOS.IMOSStoryStatus
	) {
		traceFunction('mosRoStoryStatus', fns.mosRoStoryStatus, context, id, token, status)
	}

	export function mosRoStoryInsert(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.IMOSROStory>
	) {
		traceFunction('mosRoStoryInsert', fns.mosRoStoryInsert, context, id, token, Action, Stories)
	}

	export function mosRoStoryReplace(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.IMOSROStory>
	) {
		traceFunction('mosRoStoryReplace', fns.mosRoStoryReplace, context, id, token, Action, Stories)
	}

	export function mosRoStoryMove(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSStoryAction,
		Stories: Array<MOS.MosString128>
	) {
		traceFunction('mosRoStoryMove', fns.mosRoStoryMove, context, id, token, Action, Stories)
	}

	export function mosRoStoryDelete(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSROAction,
		Stories: Array<MOS.MosString128>
	) {
		traceFunction('mosRoStoryDelete', fns.mosRoStoryDelete, context, id, token, Action, Stories)
	}

	export function mosRoStorySwap(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSROAction,
		StoryID0: MOS.MosString128,
		StoryID1: MOS.MosString128
	) {
		traceFunction('mosRoStorySwap', fns.mosRoStorySwap, context, id, token, Action, StoryID0, StoryID1)
	}

	export function mosRoReadyToAir(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSROReadyToAir
	) {
		traceFunction('mosRoReadyToAir', fns.mosRoReadyToAir, context, id, token, Action)
	}

	export function mosRoFullStory(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		story: MOS.IMOSROFullStory
	) {
		traceFunction('mosRoFullStory', fns.mosRoFullStory, context, id, token, story)
	}

	/**
	 * Unimplemented item methods.
	 * An item is an object within a Part. These do not directly map to a Piece
	 */
	export function mosRoItemDelete(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSStoryAction,
		Items: Array<MOS.MosString128>
	) {
		traceFunction('mosRoItemDelete', fns.mosRoItemDelete, context, id, token, Action, Items)
	}

	export function mosRoItemStatus(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		status: MOS.IMOSItemStatus
	) {
		traceFunction('mosRoItemStatus', fns.mosRoItemStatus, context, id, token, status)
	}

	export function mosRoItemInsert(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.IMOSItem>
	) {
		traceFunction('mosRoItemInsert', fns.mosRoItemInsert, context, id, token, Action, Items)
	}

	export function mosRoItemReplace(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.IMOSItem>
	) {
		traceFunction('mosRoItemReplace', fns.mosRoItemReplace, context, id, token, Action, Items)
	}

	export function mosRoItemMove(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSItemAction,
		Items: Array<MOS.MosString128>
	) {
		traceFunction('mosRoItemMove', fns.mosRoItemMove, context, id, token, Action, Items)
	}

	export function mosRoItemSwap(
		context: MethodContext,
		id: PeripheralDeviceId,
		token: string,
		Action: MOS.IMOSStoryAction,
		ItemID0: MOS.MosString128,
		ItemID1: MOS.MosString128
	) {
		traceFunction('mosRoItemSwap', fns.mosRoItemSwap, context, id, token, Action, ItemID0, ItemID1)
	}
}

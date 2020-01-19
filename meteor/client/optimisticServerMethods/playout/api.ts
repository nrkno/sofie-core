import { Meteor } from 'meteor/meteor'
import { setMeteorMethods, ClientSideMethods } from '../../../lib/methods'
import { PlayoutAPI } from '../../../lib/api/playout'
import { UserActionAPI } from '../../../lib/api/userActions'
import { ClientAPI } from '../../../lib/api/client'
import { Rundowns, Rundown, RundownHoldState } from '../../../lib/collections/Rundowns'
import { Parts, Part, DBPart } from '../../../lib/collections/Parts'
import { fetchAfter, getCurrentTime } from '../../../lib/lib'

/**
 * The functionality implemented in this file handles "Optimistic updates", a Meteor feature that preemptively
 * makes temporary updates client side, in order to reduce perceived lag.
 *
 * A few notes:
 * These functions are only simulating behaviour, any database updates are reverted client-side when the real
 *  server-side method is run.
 * These functions does not throw any errors, that's done server-side
 * These function does not return any values, that's done server-side
 */
let methods: ClientSideMethods = {}
methods[ClientAPI.methods.execMethod] = function (_eventContext: any, methodName: string, ...args: any[]): void {
	Meteor.call(methodName, ...args)
}


methods[PlayoutAPI.methods.rundownTake] = (rundownId: string): void => {
	simulateTakenextPart(rundownId)
}


methods[UserActionAPI.methods.take] = function (rundownId: string): void {
	// Simulate the take client side:

	simulateTakenextPart(rundownId)
}
function simulateTakenextPart (rundownId: string) {

	const now = getCurrentTime()

	let rundown = Rundowns.findOne(rundownId) as Rundown
	if (!rundown) return
	let timeOffset: number | null = rundown.nextTimeOffset || null

	if (rundown.holdState === RundownHoldState.COMPLETE) {
		// Rundowns.update(rundown._id, {
		// 	$set: {
		// 		holdState: RundownHoldState.NONE
		// 	}
		// })
		return
	} else if (rundown.holdState === RundownHoldState.ACTIVE) {
		return
	}

	const previousPart = rundown.currentPartId && Parts.findOne(rundown.currentPartId)

	const takePart = rundown.nextPartId && Parts.findOne(rundown.nextPartId)
	if (!takePart) return

	const allParts = rundown.getParts()

	const partAfter = fetchAfter(allParts, {
		rundownId: rundown._id,
		invalid: { $ne: true }
	}, takePart._rank)

	const nextPart: Part | null = partAfter || null

	let m: Partial<Rundown> = {
		previousPartId: rundown.currentPartId,
		currentPartId: takePart._id,
		// holdState: !rundown.holdState || rundown.holdState === RundownHoldState.COMPLETE ? RundownHoldState.NONE : rundown.holdState + 1,
	}
	Rundowns.update(rundown._id, {
		$set: m
	})
	let partM = {
		$push: {
			'timings.take': now,
			'timings.playOffset': timeOffset || 0
		}
	}
	Parts.update(takePart._id, partM)

	simulateSetNextPart(rundown, nextPart)
}
function simulateSetNextPart (
	rundown: Rundown,
	nextPart: DBPart | null,
	setManually?: boolean,
	nextTimeOffset?: number | undefined
) {
	let ps: Array<Promise<any>> = []
	if (nextPart) {

		if (nextPart.rundownId !== rundown._id) throw new Meteor.Error(409, `Part "${nextPart._id}" not part of rundown "${rundown._id}"`)
		if (nextPart._id === rundown.currentPartId) return
		if (nextPart.invalid) return
		if (nextPart.floated) return

		// ps.push(resetPart(nextPart))

		Rundowns.update(rundown._id, {
			$set: {
				nextPartId: nextPart._id,
				nextPartManual: !!setManually,
				nextTimeOffset: nextTimeOffset || null
			}
		})
		rundown.nextPartId = nextPart._id
		rundown.nextPartManual = !!setManually
		rundown.nextTimeOffset = nextTimeOffset || null

		// ps.push(asyncCollectionUpdate(Parts, nextPart._id, {
		// 	$push: {
		// 		'timings.next': getCurrentTime()
		// 	}
		// }))
	} else {
		Rundowns.update(rundown._id, {
			$set: {
				nextPartId: null,
				nextPartManual: !!setManually
			}
		})
		rundown.nextPartId = null
		rundown.nextPartManual = !!setManually
	}
}
setMeteorMethods(methods)

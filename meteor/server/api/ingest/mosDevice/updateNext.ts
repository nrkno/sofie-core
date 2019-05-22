import * as _ from 'underscore'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { ServerPlayoutAPI } from '../../playout/playout'
import { fetchAfter } from '../../../../lib/lib'

function getRundownValidParts (rundown: Rundown) {
	return rundown.getParts({
		$or: [
			{ invalid: false },
			{ invalid: { $exists: false } }
		]
	})
}

export namespace UpdateNext {
	export function ensureNextPartIsValid (rundown: Rundown) {
		// Ensure the next-id is still valid
		if (rundown.nextPartId) {
			const allValidParts = getRundownValidParts(rundown)

			const currentPart = allValidParts.find(part => part._id === rundown.currentPartId)
			const currentNextPart = allValidParts.find(part => part._id === rundown.nextPartId)

			// If the current part is missing, then we can't know what the next is
			if (!currentPart && rundown.currentPartId !== null) {
				if (!currentNextPart) {
					// Clear the invalid data
					ServerPlayoutAPI.setNextPartInner(rundown, null)
				}
			} else {
				const expectedAutoNextPart = fetchAfter(allValidParts, {}, currentPart ? currentPart._rank : null)
				const expectedAutoNextPartId = expectedAutoNextPart ? expectedAutoNextPart._id : null

				// If not manually set, make sure that next is done by rank
				if (!rundown.nextPartManual && expectedAutoNextPartId !== rundown.nextPartId) {
					ServerPlayoutAPI.setNextPartInner(rundown, expectedAutoNextPart || null)

				} else if (rundown.nextPartId && !currentNextPart) {
					// If the specified next is not valid, then reset
					ServerPlayoutAPI.setNextPartInner(rundown, expectedAutoNextPart || null)
				}
			}
		}
	}
	export function afterInsertParts (rundown: Rundown, newPartExternalIds: string[], removePrevious: boolean) {
		// If manually chosen, and could have been removed then special case handling
		if (rundown.nextPartManual && removePrevious) {
			const allValidParts = getRundownValidParts(rundown)

			// If the manually chosen part does not exist, assume it was the one that was removed
			const currentNextPart = allValidParts.find(part => part._id === rundown.nextPartId)
			if (!currentNextPart) {
				// Set to the first of the inserted parts
				const firstNewPart = allValidParts.find(part => newPartExternalIds.indexOf(part.externalId) !== -1)
				if (firstNewPart) {
					// Matched a part that replaced the old, so set to it
					ServerPlayoutAPI.setNextPartInner(rundown, firstNewPart)

				} else {
					// Didn't find a match. Lets assume it is because the specified part was the one that was removed, so auto it
					UpdateNext.ensureNextPartIsValid(rundown)
				}
			}
		} else {
			// Ensure next is valid
			UpdateNext.ensureNextPartIsValid(rundown)
		}
	}
}

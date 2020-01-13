import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { Rundown } from '../../../lib/collections/Rundowns'
import { ServerPlayoutAPI } from '../playout/playout'
import { fetchNext } from '../../../lib/lib'
import { RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { moveNext } from '../userActions'

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
		const playlist = RundownPlaylists.findOne(rundown.playlistId)
		if (!playlist) throw new Meteor.Error(501, `Orphaned playlist: "${rundown._id}"`)

		// Ensure the next-id is still valid
		if (rundown && playlist.active && playlist.nextPartId) {
			const allValidParts = getRundownValidParts(rundown)

			const currentPart = allValidParts.find(part => part._id === playlist.currentPartId)
			const currentNextPart = allValidParts.find(part => part._id === playlist.nextPartId)

			// If the current part is missing, then we can't know what the next is
			if (!currentPart && playlist.currentPartId !== null) {
				if (!currentNextPart) {
					// Clear the invalid data
					ServerPlayoutAPI.setNextPartInner(playlist, null)
				}
			} else {
				const expectedAutoNextPart = fetchNext(allValidParts, currentPart)
				const expectedAutoNextPartId = expectedAutoNextPart ? expectedAutoNextPart._id : null

				// If not manually set, make sure that next is done by rank
				if (!playlist.nextPartManual && expectedAutoNextPartId !== playlist.nextPartId) {
					ServerPlayoutAPI.setNextPartInner(playlist, expectedAutoNextPart || null)

				} else if (playlist.nextPartId && !currentNextPart) {
					// If the specified next is not valid, then reset
					ServerPlayoutAPI.setNextPartInner(playlist, expectedAutoNextPart || null)
				}
			}
		}
	}
	export function afterInsertParts (rundown: Rundown, newPartExternalIds: string[], removePrevious: boolean) {
		const playlist = RundownPlaylists.findOne(rundown.playlistId)
		if (!playlist) throw new Meteor.Error(501, `Orphaned rundown: "${rundown._id}"`)

		if (rundown && playlist.active) {
			// If manually chosen, and could have been removed then special case handling
			if (!playlist.nextPartId && playlist.currentPartId) {
				// The playhead is probably at the end of the rundown

				// Set Next forward
				moveNext(rundown._id, 1, 0, false)

			} else if (playlist.nextPartManual && removePrevious) {
				const allValidParts = getRundownValidParts(rundown)

				// If the manually chosen part does not exist, assume it was the one that was removed
				const currentNextPart = allValidParts.find(part => part._id === playlist.nextPartId)
				if (!currentNextPart) {
					// Set to the first of the inserted parts
					const firstNewPart = allValidParts.find(part => newPartExternalIds.indexOf(part.externalId) !== -1)
					if (firstNewPart) {
						// Matched a part that replaced the old, so set to it
						ServerPlayoutAPI.setNextPartInner(playlist, firstNewPart)

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
}

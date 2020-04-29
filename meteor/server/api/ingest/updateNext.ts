import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { Rundown } from '../../../lib/collections/Rundowns'
import { ServerPlayoutAPI } from '../playout/playout'
import { RundownPlaylists, RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { moveNext } from '../userActions'
import { selectNextPart, isTooCloseToAutonext } from '../playout/lib'

export namespace UpdateNext {
	export function ensureNextPartIsValid (playlist: RundownPlaylist) {
		// Ensure the next-id is still valid
		if (playlist && playlist.active && playlist.nextPartInstanceId) {
			const { currentPartInstance, nextPartInstance } = playlist.getSelectedPartInstances()
			const allParts = playlist.getAllOrderedParts()

			if (currentPartInstance) {
				// Leave the manually chosen part
				const oldNextPart = nextPartInstance ? allParts.find(p => p._id === nextPartInstance.part._id) : undefined
				if (playlist.nextPartManual && oldNextPart && nextPartInstance && nextPartInstance.part.isPlayable()) {
					return
				}

				// Check if the part is the same
				const newNextPart = selectNextPart(playlist, currentPartInstance, allParts)
				if (newNextPart && nextPartInstance && newNextPart.part._id === nextPartInstance.part._id) {
					return
				}

				// If we are close to an autonext, then leave it to avoid glitches
				if (isTooCloseToAutonext(currentPartInstance) && nextPartInstance) {
					return
				}

				// Set to the newly selected part
				ServerPlayoutAPI.setNextPartInner(playlist, newNextPart ? newNextPart.part : null)
			} else if (!nextPartInstance) {
				// Don't have a currentPart or a nextPart, so set next to first in the show
				const newNextPart = selectNextPart(playlist, null, allParts)
				ServerPlayoutAPI.setNextPartInner(playlist, newNextPart ? newNextPart.part : null)
			}
		}
	}
	export function afterInsertParts (playlist: RundownPlaylist, newPartExternalIds: string[], removePrevious: boolean) {
		if (playlist && playlist.active) {
			// If manually chosen, and could have been removed then special case handling
			if (!playlist.nextPartInstanceId && playlist.currentPartInstanceId) {
				// The playhead is probably at the end of the rundown

				// Try and choose something
				const { currentPartInstance } = playlist.getSelectedPartInstances()
				const newNextPart = selectNextPart(playlist, currentPartInstance || null, playlist.getAllOrderedParts())
				ServerPlayoutAPI.setNextPartInner(playlist, newNextPart ? newNextPart.part : null)

			} else if (playlist.nextPartManual && removePrevious) {
				const { nextPartInstance } = playlist.getSelectedPartInstances()
				const allParts = playlist.getAllOrderedParts()

				// If the manually chosen part does not exist, assume it was the one that was removed
				const currentNextPart = nextPartInstance ? allParts.find(part => part._id === nextPartInstance.part._id) : undefined
				if (!currentNextPart) {
					// Set to the first of the inserted parts
					const firstNewPart = allParts.find(part => newPartExternalIds.indexOf(part.externalId) !== -1 && part.isPlayable())
					if (firstNewPart) {
						// Matched a part that replaced the old, so set to it
						ServerPlayoutAPI.setNextPartInner(playlist, firstNewPart)

					} else {
						// Didn't find a match. Lets assume it is because the specified part was the one that was removed, so auto it
						UpdateNext.ensureNextPartIsValid(playlist)
					}
				}
			} else {
				// Ensure next is valid
				UpdateNext.ensureNextPartIsValid(playlist)
			}
		}
	}
}

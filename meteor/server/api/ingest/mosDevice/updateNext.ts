import * as _ from 'underscore'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { Parts } from '../../../../lib/collections/Parts'
import { ServerPlayoutAPI } from '../../playout/playout'

export namespace UpdateNext {
	export function afterDeletePart (rundown: Rundown) {
		// Ensure the next-id is still valid
		if (rundown.nextPartId) {
			const nextPart = Parts.findOne({
				rundownId: rundown._id,
				_id: rundown.nextPartId
			})
			if (!nextPart) {
				// TODO finish this
			}
		}
	}
	export function afterInsertParts (rundown: Rundown, previousPartIdStr: string, newPartIds: string[], removePrevious: boolean) {
		// TODO - this is a mess and needs a rewrite...

		if (rundown.nextPartId) {
			const nextPart = Parts.findOne({
				rundownId: rundown._id,
				_id: rundown.nextPartId
			})
			if (!nextPart) {
				// TODO finish this
			}
		}

		// TODO - test
		// Update next if we inserted before the part that is next
		if (!removePrevious && !rundown.nextPartManual && rundown.nextPartId) {
			const previousPart = Parts.findOne({
				rundownId: rundown._id,
				externalId: previousPartIdStr
			})
			if (previousPart && rundown.nextPartId === previousPart._id) {
				const newNextPart = Parts.findOne({
					rundownId: rundown._id,
					externalId: { $in: newPartIds },
					_rank: { $gt: previousPart._rank }
				}, {
					sort: {
						rank: 1
					}
				})
				if (newNextPart) {
					// Move up next-point to the first inserted part
					ServerPlayoutAPI.setNextPartInner(rundown, newNextPart._id)
				}
			}
		}
	}

	export function afterSwapParts (rundown: Rundown, story0ExternalId: string, story1ExternalId: string) {
		// TODO - test
		// Update next
		if (!rundown.nextPartManual && rundown.nextPartId) {
			const parts = Parts.find({
				rundownId: rundown._id,
				externalId: { $in: [ story0ExternalId, story1ExternalId ] }
			}).fetch()
			const nextPart = parts.find(p => p._id === rundown.nextPartId)
			// One of the swapped was next so it should now be the other
			if (nextPart) {
				// Find the first part from the other Story (could be multiple)
				const newNextPart = _.sortBy(parts, p => p._rank).find(p => p.externalId !== nextPart.externalId)
				if (newNextPart) {
					ServerPlayoutAPI.setNextPartInner(rundown, newNextPart._id)
				}
			}
		}
	}

	export function afterMoveParts (rundown: Rundown) {
		// TODO
	}
}

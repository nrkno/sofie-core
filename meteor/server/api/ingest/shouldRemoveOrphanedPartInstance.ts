import {
	BlueprintRemoveOrphanedPartInstance,
	ShowStyleBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { PartNote, SegmentNote } from '../../../lib/api/notes'
import { Rundown } from '../../../lib/collections/Rundowns'
import { ShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import { clone, literal, unprotectObject, unprotectObjectArray } from '../../../lib/lib'
import { logger } from '../../logging'
import { RemoveOrphanedPartInstanceContext } from '../blueprints/context/removeOrphanedPartInstance'
import { CacheForPlayout, getSelectedPartInstancesFromCache } from '../playout/cache'
import { isTooCloseToAutonext } from '../playout/lib'

export async function shouldRemoveOrphanedPartInstance(
	cache: CacheForPlayout,
	showStyle: ReadonlyDeep<ShowStyleCompound>,
	blueprint: ReadonlyDeep<ShowStyleBlueprintManifest>,
	rundown: ReadonlyDeep<Rundown>
): Promise<void> {
	if (!cache.Playlist.doc.activationId) return
	if (!blueprint.shouldRemoveOrphanedPartInstance) return

	const playlistPartInstances = getSelectedPartInstancesFromCache(cache)
	if (!playlistPartInstances.nextPartInstance?.orphaned) return

	const orphanedPartInstance = playlistPartInstances.nextPartInstance
	const pieceInstancesInPart = cache.PieceInstances.findFetch({
		partInstanceId: orphanedPartInstance._id,
	})

	const existingResultPartInstance: BlueprintRemoveOrphanedPartInstance = {
		partInstance: unprotectObject(orphanedPartInstance),
		pieceInstances: unprotectObjectArray(pieceInstancesInPart),
	}

	const orphanedPartInstanceContext = new RemoveOrphanedPartInstanceContext(
		{
			name: `Update to ${orphanedPartInstance.part.externalId}`,
			identifier: `rundownId=${orphanedPartInstance.part.rundownId},segmentId=${orphanedPartInstance.part.segmentId}`,
		},
		cache.Studio.doc,
		showStyle,
		rundown
	)

	try {
		blueprint.shouldRemoveOrphanedPartInstance(orphanedPartInstanceContext, clone(existingResultPartInstance))
	} catch (e) {
		logger.error(e)
	}

	// Save notes:
	if (!orphanedPartInstance.part.notes) orphanedPartInstance.part.notes = []
	const notes: PartNote[] = orphanedPartInstance.part.notes
	let changed = false
	for (const note of orphanedPartInstanceContext.notes) {
		changed = true
		notes.push(
			literal<SegmentNote>({
				type: note.type,
				message: note.message,
				origin: {
					name: '',
				},
			})
		)
	}
	if (changed) {
		cache.PartInstances.update(orphanedPartInstance._id, {
			$set: {
				'part.notes': notes,
			},
		})
	}

	if (
		orphanedPartInstanceContext.instanceIsRemoved() &&
		!isTooCloseToAutonext(playlistPartInstances.currentPartInstance)
	) {
		cache.PartInstances.update(orphanedPartInstance._id, {
			$set: {
				reset: true,
			},
		})
		cache.Playlist.update({ $unset: { nextPartInstanceId: 1 } })
	}
}

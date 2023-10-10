import { PartInstanceId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { AnyBulkWriteOperation } from 'mongodb'
import { JobContext } from '../../../jobs'
import { PlayoutPartInstanceModelImpl } from './PlayoutPartInstanceModelImpl'
import { PlayoutRundownModelImpl } from './PlayoutRundownModelImpl'

export async function writeScratchpadSegments(
	context: JobContext,
	rundowns: readonly PlayoutRundownModelImpl[]
): Promise<void> {
	const writeOps: AnyBulkWriteOperation<DBSegment>[] = []

	for (const rundown of rundowns) {
		if (rundown.ScratchPadSegmentHasChanged) {
			rundown.clearScratchPadSegmentChangedFlag()
			const scratchpadSegment = rundown.getScratchpadSegment()?.Segment

			// Delete a removed scratchpad, and any with the non-current id (just in case)
			writeOps.push({
				deleteMany: {
					filter: {
						rundownId: rundown.Rundown._id,
						_id: { $ne: scratchpadSegment?._id ?? protectString('') },
					},
				},
			})

			// Update/insert the segment
			if (scratchpadSegment) {
				writeOps.push({
					replaceOne: {
						filter: { _id: scratchpadSegment._id },
						replacement: scratchpadSegment as DBSegment,
						upsert: true,
					},
				})
			}
		}
	}

	if (writeOps.length) {
		await context.directCollections.Segments.bulkWrite(writeOps)
	}
}

export function writePartInstancesAndPieceInstances(
	context: JobContext,
	partInstances: Map<PartInstanceId, PlayoutPartInstanceModelImpl | null>
): [Promise<unknown>, Promise<unknown>] {
	const partInstanceOps: AnyBulkWriteOperation<DBPartInstance>[] = []
	const pieceInstanceOps: AnyBulkWriteOperation<PieceInstance>[] = []

	const deletedPartInstanceIds: PartInstanceId[] = []
	const deletedPieceInstanceIds: PieceInstanceId[] = []

	for (const [partInstanceId, partInstance] of partInstances.entries()) {
		if (!partInstance) {
			deletedPartInstanceIds.push(partInstanceId)
		} else {
			partInstanceOps.push({
				replaceOne: {
					filter: { _id: partInstanceId },
					replacement: partInstance.PartInstanceImpl,
					upsert: true,
				},
			})

			for (const [pieceInstanceId, pieceInstance] of partInstance.PieceInstancesImpl.entries()) {
				if (!pieceInstance.doc) {
					deletedPieceInstanceIds.push(pieceInstanceId)
				} else if (pieceInstance.changed) {
					// TODO - this does not perform any diffing
					pieceInstanceOps.push({
						replaceOne: {
							filter: { _id: pieceInstanceId },
							replacement: pieceInstance.doc,
							upsert: true,
						},
					})
				}
			}

			partInstance.clearChangedFlags()
		}
	}

	// Delete any removed PartInstances
	if (deletedPartInstanceIds.length) {
		partInstanceOps.push({
			deleteMany: {
				filter: {
					_id: { $in: deletedPartInstanceIds },
				},
			},
		})
		pieceInstanceOps.push({
			deleteMany: {
				filter: {
					partInstanceId: { $in: deletedPartInstanceIds },
				},
			},
		})
	}

	// Delete any removed PieceInstances
	if (deletedPieceInstanceIds.length) {
		pieceInstanceOps.push({
			deleteMany: {
				filter: {
					_id: { $in: deletedPieceInstanceIds },
				},
			},
		})
	}

	return [
		partInstanceOps.length ? context.directCollections.PartInstances.bulkWrite(partInstanceOps) : Promise.resolve(),
		pieceInstanceOps.length
			? context.directCollections.PieceInstances.bulkWrite(pieceInstanceOps)
			: Promise.resolve(),
	]
}

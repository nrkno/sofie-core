import {
	BlueprintSyncIngestNewData,
	BlueprintSyncIngestPartInstance,
	IBlueprintAdLibPieceDB,
} from '@sofie-automation/blueprints-integration'
import { JobContext } from '../jobs'
import { PlayoutModel } from '../playout/model/PlayoutModel'
import { PlayoutPartInstanceModel } from '../playout/model/PlayoutPartInstanceModel'
import { IngestModelReadonly } from './model/IngestModel'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { stringifyError } from '@sofie-automation/shared-lib/dist/lib/stringifyError'
import { logger } from '../logging'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from '../playout/infinites'
import _ = require('underscore')
import { SyncIngestUpdateToPartInstanceContext } from '../blueprints/context'
import {
	convertAdLibActionToBlueprints,
	convertAdLibPieceToBlueprints,
	convertPartInstanceToBlueprints,
	convertPartToBlueprints,
	convertPieceInstanceToBlueprints,
} from '../blueprints/context/lib'
import { validateAdlibTestingPartInstanceProperties } from '../playout/adlibTesting'
import { ReadonlyDeep } from 'type-fest'
import { convertIngestModelToPlayoutRundownWithSegments } from './commit'
import { convertNoteToNotification } from '../notifications/util'
import { PlayoutRundownModel } from '../playout/model/PlayoutRundownModel'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'

type PlayStatus = 'previous' | 'current' | 'next'
type SyncedInstance = {
	existingPartInstance: PlayoutPartInstanceModel
	previousPartInstance: PlayoutPartInstanceModel | null
	playStatus: PlayStatus
	newPart: ReadonlyDeep<DBPart> | undefined
	piecesThatMayBeActive: Promise<ReadonlyDeep<Piece>[]>
}

/**
 * Attempt to sync the current and next Part into their PartInstances
 * This defers out to the Blueprints to do the syncing
 * @param context Context of the job ebeing run
 * @param playoutModel Playout model containing containing the Rundown being ingested
 * @param ingestModel Ingest model for the Rundown
 */
export async function syncChangesToPartInstances(
	context: JobContext,
	playoutModel: PlayoutModel,
	ingestModel: IngestModelReadonly
): Promise<void> {
	if (playoutModel.playlist.activationId) {
		// Get the final copy of the rundown
		const playoutRundownModel = convertIngestModelToPlayoutRundownWithSegments(ingestModel)

		const showStyle = await context.getShowStyleCompound(
			playoutRundownModel.rundown.showStyleVariantId,
			playoutRundownModel.rundown.showStyleBaseId
		)
		const blueprint = await context.getShowStyleBlueprint(showStyle._id)

		if (blueprint.blueprint.syncIngestUpdateToPartInstance) {
			const currentPartInstance = playoutModel.currentPartInstance
			const nextPartInstance = playoutModel.nextPartInstance
			const previousPartInstance = playoutModel.previousPartInstance

			const instances: SyncedInstance[] = []
			if (currentPartInstance) {
				// If the currentPartInstance is adlibbed we probably also need to find the earliest
				// non-adlibbed Part within this segment and check it for updates too. It may have something
				// changed (like timing) that will affect what's going on.
				// The previous "planned" Part Instance needs to be inserted into the `instances` first, so that
				// it's ran first through the blueprints.
				if (currentPartInstance.partInstance.orphaned === 'adlib-part') {
					const partAndPartInstance = findLastUnorphanedPartInstanceInSegment(
						playoutModel,
						currentPartInstance.partInstance
					)
					if (partAndPartInstance) {
						insertToSyncedInstanceCandidates(
							context,
							instances,
							playoutModel,
							ingestModel,
							partAndPartInstance.partInstance,
							null,
							partAndPartInstance.part,
							'previous'
						)
					}
				}
				// We can now run the current Part Instance.
				findPartAndInsertToSyncedInstanceCandidates(
					context,
					instances,
					playoutModel,
					ingestModel,
					currentPartInstance,
					previousPartInstance,
					'current'
				)
			}
			if (nextPartInstance) {
				findPartAndInsertToSyncedInstanceCandidates(
					context,
					instances,
					playoutModel,
					ingestModel,
					nextPartInstance,
					currentPartInstance,
					currentPartInstance?.isTooCloseToAutonext(false) ? 'current' : 'next'
				)
			}

			for (const {
				existingPartInstance,
				previousPartInstance,
				playStatus,
				newPart,
				piecesThatMayBeActive,
			} of instances) {
				const pieceInstancesInPart = existingPartInstance.pieceInstances

				const partId = existingPartInstance.partInstance.part._id
				const existingResultPartInstance: BlueprintSyncIngestPartInstance = {
					partInstance: convertPartInstanceToBlueprints(existingPartInstance.partInstance),
					pieceInstances: pieceInstancesInPart.map((p) => convertPieceInstanceToBlueprints(p.pieceInstance)),
				}

				const part = newPart ?? existingPartInstance.partInstance.part

				let playoutRundownModelForPart: PlayoutRundownModel | undefined = playoutRundownModel
				// Handle a case where the part is in a different rundown than the playoutRundownModel:
				if (playoutRundownModel.rundown._id !== part.rundownId) {
					playoutRundownModelForPart = playoutModel.getRundown(part.rundownId)
				}
				if (!playoutRundownModelForPart)
					throw new Error(`Internal Error: playoutRundownModelForPart is undefined (it should never be)`)

				// TMP: wrap in try/catch for troubleshooting:
				let proposedPieceInstances: PieceInstance[] = []
				try {
					proposedPieceInstances = getPieceInstancesForPart(
						context,
						playoutModel,
						previousPartInstance,
						playoutRundownModelForPart,
						part,
						await piecesThatMayBeActive,
						existingPartInstance.partInstance._id
					)
				} catch (e) {
					logger.error(
						`TROUBLESHOOTING: currentPartInstance: ${JSON.stringify(playoutModel.currentPartInstance)}`
					)
					logger.error(`TROUBLESHOOTING: nextPartInstance: ${JSON.stringify(playoutModel.nextPartInstance)}`)
					logger.error(
						`TROUBLESHOOTING: previousPartInstance: ${JSON.stringify(playoutModel.previousPartInstance)}`
					)

					throw e
				}

				logger.info(`Syncing ingest changes for part: ${partId} (orphaned: ${!!newPart})`)

				const ingestPart = ingestModel.findPart(partId)

				const referencedAdlibs: IBlueprintAdLibPieceDB[] = []
				for (const adLibPieceId of _.compact(pieceInstancesInPart.map((p) => p.pieceInstance.adLibSourceId))) {
					const adLibPiece = ingestModel.findAdlibPiece(adLibPieceId)
					if (adLibPiece) referencedAdlibs.push(convertAdLibPieceToBlueprints(adLibPiece))
				}

				const newResultData: BlueprintSyncIngestNewData = {
					part: newPart ? convertPartToBlueprints(newPart) : undefined,
					pieceInstances: proposedPieceInstances.map(convertPieceInstanceToBlueprints),
					adLibPieces: newPart && ingestPart ? ingestPart.adLibPieces.map(convertAdLibPieceToBlueprints) : [],
					actions: newPart && ingestPart ? ingestPart.adLibActions.map(convertAdLibActionToBlueprints) : [],
					referencedAdlibs: referencedAdlibs,
				}

				const partInstanceSnapshot = existingPartInstance.snapshotMakeCopy()

				const syncContext = new SyncIngestUpdateToPartInstanceContext(
					context,
					{
						name: `Update to ${existingPartInstance.partInstance.part.externalId}`,
						identifier: `rundownId=${existingPartInstance.partInstance.part.rundownId},segmentId=${existingPartInstance.partInstance.part.segmentId}`,
					},
					context.studio,
					showStyle,
					playoutRundownModel.rundown,
					existingPartInstance,
					proposedPieceInstances,
					playStatus
				)
				// TODO - how can we limit the frequency we run this? (ie, how do we know nothing affecting this has changed)
				try {
					// The blueprint handles what in the updated part is going to be synced into the partInstance:
					blueprint.blueprint.syncIngestUpdateToPartInstance(
						syncContext,
						existingResultPartInstance,
						newResultData,
						playStatus
					)
				} catch (err) {
					logger.error(`Error in showStyleBlueprint.syncIngestUpdateToPartInstance: ${stringifyError(err)}`)

					// Operation failed, rollback the changes
					existingPartInstance.snapshotRestore(partInstanceSnapshot)
				}

				if (playStatus === 'next') {
					existingPartInstance.recalculateExpectedDurationWithTransition()
				}

				// Save notes:
				const notificationCategory = `syncIngestUpdateToPartInstance:${existingPartInstance.partInstance._id}`
				playoutModel.clearAllNotifications(notificationCategory)
				for (const note of syncContext.notes) {
					playoutModel.setNotification(notificationCategory, {
						...convertNoteToNotification(note, [blueprint.blueprintId]),
						relatedTo: {
							type: 'partInstance',
							rundownId: existingPartInstance.partInstance.part.rundownId,
							partInstanceId: existingPartInstance.partInstance._id,
						},
					})
				}

				// Make sure an adlib-testing part is still labeled correctly. This could happen if the partInstance used any recently updated adlibs
				validateAdlibTestingPartInstanceProperties(context, playoutModel, existingPartInstance)

				if (existingPartInstance.partInstance._id === playoutModel.playlist.currentPartInfo?.partInstanceId) {
					// This should be run after 'current', before 'next':
					await syncPlayheadInfinitesForNextPartInstance(
						context,
						playoutModel,
						playoutModel.currentPartInstance,
						playoutModel.nextPartInstance
					)
				}
			}
		} else {
			// blueprint.syncIngestUpdateToPartInstance is not set, default behaviour is to not sync the partInstance at all.
		}
	}
}

/**
 * Inserts given PartInstances and underlying Part to the list of PartInstances to be synced
 */
function insertToSyncedInstanceCandidates(
	context: JobContext,
	instances: SyncedInstance[],
	playoutModel: PlayoutModel,
	ingestModel: IngestModelReadonly,
	thisPartInstance: PlayoutPartInstanceModel,
	previousPartInstance: PlayoutPartInstanceModel | null,
	part: ReadonlyDeep<DBPart> | undefined,
	playStatus: PlayStatus
): void {
	instances.push({
		existingPartInstance: thisPartInstance,
		previousPartInstance: previousPartInstance,
		playStatus,
		newPart: part,
		piecesThatMayBeActive: fetchPiecesThatMayBeActiveForPart(
			context,
			playoutModel,
			ingestModel,
			part ?? thisPartInstance.partInstance.part
		),
	})
}

/**
 * Finds the underlying Part for a given `thisPartInstance` and inserts it to the list of PartInstances to be synced.
 * Doesn't do anything if it can't find the underlying Part in `model`.
 */
function findPartAndInsertToSyncedInstanceCandidates(
	context: JobContext,
	instances: SyncedInstance[],
	playoutModel: PlayoutModel,
	ingestModel: IngestModelReadonly,
	thisPartInstance: PlayoutPartInstanceModel,
	previousPartInstance: PlayoutPartInstanceModel | null,
	playStatus: PlayStatus
): void {
	const newPart = playoutModel.findPart(thisPartInstance.partInstance.part._id)

	insertToSyncedInstanceCandidates(
		context,
		instances,
		playoutModel,
		ingestModel,
		thisPartInstance,
		previousPartInstance,
		newPart,
		playStatus
	)
}

/**
 * Finds the most recent Part before a given `currentPartInstance` within the current Segment. Then finds the
 * PartInstance that matches that Part. Returns them if found or returns `null` if it can't find anything.
 */
function findLastUnorphanedPartInstanceInSegment(
	playoutModel: PlayoutModel,
	currentPartInstance: ReadonlyDeep<DBPartInstance>
): {
	partInstance: PlayoutPartInstanceModel
	part: ReadonlyDeep<DBPart>
} | null {
	// Find the "latest" (last played), non-orphaned PartInstance in this Segment, in this play-through
	const previousPartInstance = playoutModel.sortedLoadedPartInstances
		.reverse()
		.find(
			(p) =>
				p.partInstance.playlistActivationId === currentPartInstance.playlistActivationId &&
				p.partInstance.segmentId === currentPartInstance.segmentId &&
				p.partInstance.segmentPlayoutId === currentPartInstance.segmentPlayoutId &&
				p.partInstance.takeCount < currentPartInstance.takeCount &&
				!!p.partInstance.orphaned &&
				!p.partInstance.reset
		)

	if (!previousPartInstance) return null

	const previousPart = playoutModel.findPart(previousPartInstance.partInstance.part._id)
	if (!previousPart) return null

	return {
		partInstance: previousPartInstance,
		part: previousPart,
	}
}

import { IngestPart } from '@sofie-automation/blueprints-integration'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { literal } from '@sofie-automation/corelib/dist/lib'
import {
	MosRundownProps,
	MosRundownMetadataProps,
	MosRundownStatusProps,
	MosRundownReadyToAirProps,
} from '@sofie-automation/corelib/dist/worker/ingest'
import { JobContext } from '../../jobs'
import { getCurrentTime } from '../../lib'
import _ = require('underscore')
import { LocalIngestRundown } from '../ingestCache'
import { getRundownId, getPartId, canRundownBeUpdated } from '../lib'
import { runIngestJob, CommitIngestData, runWithRundownLock } from '../lock'
import { diffAndUpdateSegmentIds } from './diff'
import { parseMosString } from './lib'
import { groupedPartsToSegments, groupIngestParts, storiesToIngestParts } from './mosToIngest'
import { updateRundownFromIngestData, updateRundownMetadataFromIngestData } from '../generationRundown'

/**
 * Insert or update a mos rundown
 */
export async function handleMosRundownData(context: JobContext, data: MosRundownProps): Promise<void> {
	// Create or update a rundown (ie from rundownCreate or rundownList)

	if (parseMosString(data.mosRunningOrder.ID) !== data.rundownExternalId)
		throw new Error('mosRunningOrder.ID and rundownExternalId mismatch!')

	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			const rundownId = getRundownId(context.studioId, data.rundownExternalId)
			const parts = _.compact(
				storiesToIngestParts(context, rundownId, data.mosRunningOrder.Stories || [], data.isUpdateOperation, [])
			)
			const groupedStories = groupIngestParts(parts)

			// If this is a reload of a RO, then use cached data to make the change more seamless
			if (data.isUpdateOperation && ingestRundown) {
				const partCacheMap = new Map<PartId, IngestPart>()
				for (const segment of ingestRundown.segments) {
					for (const part of segment.parts) {
						partCacheMap.set(getPartId(rundownId, part.externalId), part)
					}
				}

				for (const annotatedPart of parts) {
					const cached = partCacheMap.get(annotatedPart.partId)
					if (cached && !annotatedPart.ingest.payload) {
						annotatedPart.ingest.payload = cached.payload
					}
				}
			}

			const ingestSegments = groupedPartsToSegments(rundownId, groupedStories)

			return literal<LocalIngestRundown>({
				externalId: data.rundownExternalId,
				name: parseMosString(data.mosRunningOrder.Slug),
				type: 'mos',
				segments: ingestSegments,
				payload: data.mosRunningOrder,
				modified: getCurrentTime(),
			})
		},
		async (context, cache, newIngestRundown, oldIngestRundown) => {
			if (!newIngestRundown) throw new Error(`handleMosRundownData lost the IngestRundown...`)

			if (!canRundownBeUpdated(cache.Rundown.doc, !data.isUpdateOperation)) return null

			let renamedSegments: CommitIngestData['renamedSegments'] = new Map()
			if (cache.Rundown.doc && oldIngestRundown) {
				// If we already have a rundown, update any modified segment ids
				renamedSegments = diffAndUpdateSegmentIds(context, cache, oldIngestRundown, newIngestRundown)
			}

			const res = await updateRundownFromIngestData(
				context,
				cache,
				newIngestRundown,
				!data.isUpdateOperation,
				data.peripheralDeviceId
			)
			if (res) {
				return {
					...res,
					renamedSegments: renamedSegments,
				}
			} else {
				return null
			}
		}
	)
}

/**
 * Update the payload of a mos rundown, without changing any parts or segments
 */
export async function handleMosRundownMetadata(context: JobContext, data: MosRundownMetadataProps): Promise<void> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				ingestRundown.payload = _.extend(ingestRundown.payload, data.mosRunningOrderBase)
				ingestRundown.modified = getCurrentTime()

				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (context, cache, ingestRundown) => {
			if (!ingestRundown) throw new Error(`handleMosRundownMetadata lost the IngestRundown...`)

			return updateRundownMetadataFromIngestData(context, cache, ingestRundown, data.peripheralDeviceId)
		}
	)
}

/**
 * Update the status of a mos rundown
 */
export async function handleMosRundownStatus(context: JobContext, data: MosRundownStatusProps): Promise<void> {
	const rundownId = getRundownId(context.studioId, data.rundownExternalId)

	return runWithRundownLock(context, rundownId, async (rundown) => {
		if (!rundown) throw new Error(`Rundown "${rundownId}" not found!`)

		if (!canRundownBeUpdated(rundown, false)) return

		await context.directCollections.Rundowns.update(
			rundown._id,
			{
				$set: {
					status: data.status,
				},
			},
			null // Single operation of this job
		)
	})
}

/**
 * Update the ready to air state of a mos rundown
 */
export async function handleMosRundownReadyToAir(context: JobContext, data: MosRundownReadyToAirProps): Promise<void> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				// No change
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (context, cache, ingestRundown) => {
			if (!ingestRundown) throw new Error(`handleMosRundownReadyToAir lost the IngestRundown...`)

			if (!cache.Rundown.doc || cache.Rundown.doc.airStatus === data.status) return null

			// If rundown is orphaned, then it should be ignored
			if (cache.Rundown.doc.orphaned) return null

			cache.Rundown.update((rd) => {
				rd.airStatus = data.status
				return rd
			})

			return updateRundownMetadataFromIngestData(context, cache, ingestRundown, data.peripheralDeviceId)
		}
	)
}

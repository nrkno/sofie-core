import { getCurrentTime } from '../lib'
import { JobContext } from '../jobs'
import { updateSegmentFromIngestData } from './generationSegment'
import { makeNewIngestPart } from './ingestCache'
import { runIngestJob } from './lock'
import { IngestRemovePartProps, IngestUpdatePartProps } from '@sofie-automation/corelib/dist/worker/ingest'

/**
 * Remove a Part from a Segment
 */
export async function handleRemovedPart(context: JobContext, data: IngestRemovePartProps): Promise<void> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestSegment = ingestRundown.segments.find((s) => s.externalId === data.segmentExternalId)
				if (!ingestSegment) {
					throw new Error(
						`Rundown "${data.rundownExternalId}" does not have a Segment "${data.segmentExternalId}" to update`
					)
				}
				ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== data.partExternalId)
				ingestSegment.modified = getCurrentTime()

				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (context, cache, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments?.find((s) => s.externalId === data.segmentExternalId)
			if (!ingestSegment) throw new Error(`IngestSegment "${data.segmentExternalId}" is missing!`)
			return updateSegmentFromIngestData(context, cache, ingestSegment, false)
		}
	)
}

/**
 * Insert or update a Part in a Segment
 */
export async function handleUpdatedPart(context: JobContext, data: IngestUpdatePartProps): Promise<void> {
	return runIngestJob(
		context,
		data,
		(ingestRundown) => {
			if (ingestRundown) {
				const ingestSegment = ingestRundown.segments.find((s) => s.externalId === data.segmentExternalId)
				if (!ingestSegment) {
					throw new Error(
						`Rundown "${data.rundownExternalId}" does not have a Segment "${data.segmentExternalId}" to update`
					)
				}
				ingestSegment.parts = ingestSegment.parts.filter((p) => p.externalId !== data.ingestPart.externalId)
				ingestSegment.parts.push(makeNewIngestPart(data.ingestPart))
				ingestSegment.modified = getCurrentTime()

				// We modify in-place
				return ingestRundown
			} else {
				throw new Error(`Rundown "${data.rundownExternalId}" not found`)
			}
		},
		async (context, cache, ingestRundown) => {
			const ingestSegment = ingestRundown?.segments?.find((s) => s.externalId === data.segmentExternalId)
			if (!ingestSegment) throw new Error(`IngestSegment "${data.segmentExternalId}" is missing!`)
			return updateSegmentFromIngestData(context, cache, ingestSegment, false)
		}
	)
}

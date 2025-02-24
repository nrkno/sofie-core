import type { RundownId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { NrcsIngestCacheType } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import {
	IngestRundownStatus,
	IngestPartPlaybackStatus,
	IngestRundownActiveStatus,
	IngestPartStatus,
	IngestPartNotifyItemReady,
} from '@sofie-automation/shared-lib/dist/ingest/rundownStatus'
import type { ReadonlyDeep } from 'type-fest'
import _ from 'underscore'
import type { ContentCache, PartFields, PartInstanceFields, PlaylistFields } from './reactiveContentCache'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ReactiveCacheCollection } from '../lib/ReactiveCacheCollection'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { IngestPart } from '@sofie-automation/blueprints-integration'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'

export function createIngestRundownStatus(
	cache: ReadonlyDeep<ContentCache>,
	rundownId: RundownId
): IngestRundownStatus | null {
	const rundown = cache.Rundowns.findOne(rundownId)
	if (!rundown) return null

	const newDoc: IngestRundownStatus = {
		_id: rundownId,
		externalId: rundown.externalId,

		active: IngestRundownActiveStatus.INACTIVE,

		segments: [],
	}

	const playlist = cache.Playlists.findOne({
		_id: rundown.playlistId,
		activationId: { $exists: true },
	})

	if (playlist) {
		newDoc.active = playlist.rehearsal ? IngestRundownActiveStatus.REHEARSAL : IngestRundownActiveStatus.ACTIVE
	}

	const nrcsSegments = cache.NrcsIngestData.find({ rundownId, type: NrcsIngestCacheType.SEGMENT }).fetch()
	for (const nrcsSegment of nrcsSegments) {
		const nrcsParts = cache.NrcsIngestData.find({
			rundownId,
			segmentId: nrcsSegment.segmentId,
			type: NrcsIngestCacheType.PART,
		}).fetch()

		newDoc.segments.push({
			externalId: nrcsSegment.data.externalId,
			parts: _.compact(
				nrcsParts.map((nrcsPart) => {
					if (!nrcsPart.partId || !nrcsPart.segmentId) return null

					const parts = cache.Parts.find({
						rundownId: rundownId,
						$or: [
							{
								externalId: nrcsPart.data.externalId,
								ingestNotifyPartExternalId: { $exists: false },
							},
							{
								ingestNotifyPartExternalId: nrcsPart.data.externalId,
							},
						],
					}).fetch()
					const partInstances = findPartInstancesForIngestPart(
						playlist,
						rundownId,
						cache.PartInstances,
						nrcsPart.data.externalId
					)

					return createIngestPartStatus(playlist, partInstances, parts, nrcsPart.data as IngestPart)
				})
			),
		})
	}

	return newDoc
}

function findPartInstancesForIngestPart(
	playlist: Pick<DBRundownPlaylist, PlaylistFields> | undefined,
	rundownId: RundownId,
	partInstancesCache: ReadonlyDeep<ReactiveCacheCollection<Pick<PartInstance, PartInstanceFields>>>,
	partExternalId: string
) {
	const result: Record<string, Pick<PartInstance, PartInstanceFields>> = {}
	if (!playlist) return result

	const candidatePartInstances = partInstancesCache
		.find({
			rundownId: rundownId,
			$or: [
				{
					'part.externalId': partExternalId,
					'part.ingestNotifyPartExternalId': { $exists: false },
				},
				{
					'part.ingestNotifyPartExternalId': partExternalId,
				},
			],
		})
		.fetch()

	for (const partInstance of candidatePartInstances) {
		if (partInstance.rundownId !== rundownId) continue
		// Ignore the next partinstance
		if (partInstance._id === playlist.nextPartInfo?.partInstanceId) continue

		const partId = unprotectString(partInstance.part._id)

		// The current part instance is the most important
		if (partInstance._id === playlist.currentPartInfo?.partInstanceId) {
			result[partId] = partInstance
			continue
		}

		// Take the part with the highest takeCount
		const existingEntry = result[partId]
		if (!existingEntry || existingEntry.takeCount < partInstance.takeCount) {
			result[partId] = partInstance
		}
	}

	return result
}

function createIngestPartStatus(
	playlist: Pick<DBRundownPlaylist, PlaylistFields> | undefined,
	partInstances: Record<string, Pick<PartInstance, PartInstanceFields>>,
	parts: Pick<DBPart, PartFields>[],
	ingestPart: IngestPart
): IngestPartStatus {
	// Determine the playback status from the PartInstance
	let playbackStatus = IngestPartPlaybackStatus.UNKNOWN

	let isReady: boolean | null = null // Start off as null, the first value will make this true or false

	const itemsReady: IngestPartNotifyItemReady[] = []

	const updateStatusWithPart = (part: Pick<DBPart, PartFields>) => {
		// If the part affects the ready status, update it
		if (typeof part.ingestNotifyPartReady === 'boolean') {
			isReady = (isReady ?? true) && part.ingestNotifyPartReady
		}

		// Include the items
		if (part.ingestNotifyItemsReady) {
			itemsReady.push(...part.ingestNotifyItemsReady)
		}
	}

	// Loop through the partInstances, starting off the state
	if (playlist) {
		for (const partInstance of Object.values<Pick<PartInstance, PartInstanceFields>>(partInstances)) {
			if (!partInstance) continue

			if (partInstance.part.shouldNotifyCurrentPlayingPart) {
				const isCurrentPartInstance = playlist.currentPartInfo?.partInstanceId === partInstance._id

				if (isCurrentPartInstance) {
					// If the current, it is playing
					playbackStatus = IngestPartPlaybackStatus.PLAY
				} else if (playbackStatus === IngestPartPlaybackStatus.UNKNOWN) {
					// If not the current, but has been played, it is stopped
					playbackStatus = IngestPartPlaybackStatus.STOP
				}
			}

			updateStatusWithPart(partInstance.part)
		}
	}

	for (const part of parts) {
		// Check if the part has already been handled by a partInstance
		if (partInstances[unprotectString(part._id)]) continue

		updateStatusWithPart(part)
	}

	return {
		externalId: ingestPart.externalId,

		isReady: isReady,
		itemsReady: itemsReady,

		playbackStatus,
	}
}

import type { RundownId, PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { NrcsIngestCacheType } from '@sofie-automation/corelib/dist/dataModel/NrcsIngestDataCache'
import type { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	IngestRundownStatus,
	IngestPartPlaybackStatus,
	IngestRundownActiveStatus,
	IngestPartStatus,
} from '@sofie-automation/shared-lib/dist/ingest/rundownStatus'
import type { ReadonlyDeep } from 'type-fest'
import _ from 'underscore'
import type { ContentCache, PartFields, PartInstanceFields, PlaylistFields } from './reactiveContentCache'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { ReactiveCacheCollection } from '../lib/ReactiveCacheCollection'
import { PartInstance } from '@sofie-automation/meteor-lib/dist/collections/PartInstances'
import { IngestPart } from '@sofie-automation/blueprints-integration'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'

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

	// Find the most important part instance for each part
	const partInstanceMap = findPartInstanceForEachPart(playlist, rundownId, cache.PartInstances)

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

					const part = cache.Parts.findOne({ _id: nrcsPart.partId, rundownId })
					const partInstance = partInstanceMap.get(nrcsPart.partId)

					return createIngestPartStatus(playlist, partInstance, part, nrcsPart.data as IngestPart)
				})
			),
		})
	}

	return newDoc
}

function findPartInstanceForEachPart(
	playlist: Pick<DBRundownPlaylist, PlaylistFields> | undefined,
	rundownId: RundownId,
	partInstancesCache: ReadonlyDeep<ReactiveCacheCollection<Pick<PartInstance, PartInstanceFields>>>
) {
	const partInstanceMap = new Map<PartId, Pick<DBPartInstance, PartInstanceFields>>()
	if (!playlist) return partInstanceMap

	for (const partInstance of partInstancesCache.find({}).fetch()) {
		if (partInstance.rundownId !== rundownId) continue
		// Ignore the next partinstance
		if (partInstance._id === playlist.nextPartInfo?.partInstanceId) continue

		// The current part instance is the most important
		if (partInstance._id === playlist.currentPartInfo?.partInstanceId) {
			partInstanceMap.set(partInstance.part._id, partInstance)
			continue
		}

		// Take the part with the highest takeCount
		const existingEntry = partInstanceMap.get(partInstance.part._id)
		if (!existingEntry || existingEntry.takeCount < partInstance.takeCount) {
			partInstanceMap.set(partInstance.part._id, partInstance)
		}
	}

	return partInstanceMap
}

function createIngestPartStatus(
	playlist: Pick<DBRundownPlaylist, PlaylistFields> | undefined,
	partInstance: Pick<PartInstance, PartInstanceFields> | undefined,
	part: Pick<DBPart, PartFields> | undefined,
	ingestPart: IngestPart
): IngestPartStatus {
	// Determine the playback status from the PartInstance
	let playbackStatus = IngestPartPlaybackStatus.UNKNOWN
	if (playlist && partInstance && partInstance.part.shouldNotifyCurrentPlayingPart) {
		const isCurrentPartInstance = playlist.currentPartInfo?.partInstanceId === partInstance._id

		if (isCurrentPartInstance) {
			// If the current, it is playing
			playbackStatus = IngestPartPlaybackStatus.PLAY
		} else {
			// If not the current, but has been played, it is stopped
			playbackStatus = IngestPartPlaybackStatus.STOP
		}
	}

	// Determine the ready status from the PartInstance or Part
	const isReady = partInstance ? partInstance.part.ingestNotifyPartReady : part?.ingestNotifyPartReady
	const itemsReady = partInstance ? partInstance.part.ingestNotifyItemsReady : part?.ingestNotifyItemsReady

	return {
		externalId: ingestPart.externalId,

		isReady: isReady ?? null,
		itemsReady: itemsReady ?? {},

		playbackStatus,
	}
}

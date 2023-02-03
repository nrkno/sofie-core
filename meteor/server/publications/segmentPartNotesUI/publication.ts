import { RundownId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, PubSub } from '../../../lib/api/pubsub'
import { UISegmentPartNote } from '../../../lib/api/rundownNotifications'
import { DBPartInstance } from '../../../lib/collections/PartInstances'
import { DBPart } from '../../../lib/collections/Parts'
import { Rundown } from '../../../lib/collections/Rundowns'
import { DBSegment } from '../../../lib/collections/Segments'
import { groupByToMap, literal, normalizeArrayToMap, protectString } from '../../../lib/lib'
import {
	CustomPublishCollection,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
	TriggerUpdate,
} from '../../lib/customPublication'
import { logger } from '../../logging'
import { resolveCredentials } from '../../security/lib/credentials'
import { NoSecurityReadAccess } from '../../security/noSecurity'
import { RundownPlaylistReadAccess } from '../../security/rundownPlaylist'
import { LiveQueryHandle } from '../../lib/lib'
import { ContentCache, PartFields, PartInstanceFields, RundownFields, SegmentFields } from './reactiveContentCache'
import { RundownsObserver } from '../lib/rundownsObserver'
import { RundownContentObserver } from './rundownContentObserver'
import { RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { generateNotesForSegment } from './generateNotesForSegment'

interface UISegmentPartNotesArgs {
	readonly playlistId: RundownPlaylistId
}

export interface UISegmentPartNotesState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface UISegmentPartNotesUpdateProps {
	newCache: ContentCache

	invalidateRundownIds: RundownId[]
	invalidateSegmentIds: SegmentId[]
}

type RundownPlaylistFields = '_id' | 'studioId'
const rundownPlaylistFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<RundownPlaylistFields>>({
	_id: 1,
	studioId: 1,
})

async function setupUISegmentPartNotesPublicationObservers(
	args: ReadonlyDeep<UISegmentPartNotesArgs>,
	triggerUpdate: TriggerUpdate<UISegmentPartNotesUpdateProps>
): Promise<LiveQueryHandle[]> {
	const playlist = (await RundownPlaylists.findOneAsync(args.playlistId, {
		projection: rundownPlaylistFieldSpecifier,
	})) as Pick<RundownPlaylist, RundownPlaylistFields> | undefined
	if (!playlist) throw new Error(`RundownPlaylist "${args.playlistId}" not found!`)

	const rundownsObserver = new RundownsObserver(playlist.studioId, playlist._id, (rundownIds) => {
		logger.silly(`Creating new RundownContentObserver`)
		const obs1 = new RundownContentObserver(rundownIds, (cache) => {
			// Push update
			triggerUpdate({ newCache: cache })

			const innerQueries = [
				cache.Segments.find({}).observeChanges({
					added: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
					changed: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
					removed: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
				}),
				cache.Parts.find({}).observe({
					added: (doc) => triggerUpdate({ invalidateSegmentIds: [doc.segmentId] }),
					changed: (doc, oldDoc) =>
						triggerUpdate({ invalidateSegmentIds: [doc.segmentId, oldDoc.segmentId] }),
					removed: (doc) => triggerUpdate({ invalidateSegmentIds: [doc.segmentId] }),
				}),
				cache.DeletedPartInstances.find({}).observe({
					added: (doc) => triggerUpdate({ invalidateSegmentIds: [doc.segmentId] }),
					changed: (doc, oldDoc) =>
						triggerUpdate({ invalidateSegmentIds: [doc.segmentId, oldDoc.segmentId] }),
					removed: (doc) => triggerUpdate({ invalidateSegmentIds: [doc.segmentId] }),
				}),
				cache.Rundowns.find({}).observeChanges({
					added: (id) => triggerUpdate({ invalidateRundownIds: [protectString(id)] }),
					changed: (id) => triggerUpdate({ invalidateRundownIds: [protectString(id)] }),
					removed: (id) => triggerUpdate({ invalidateRundownIds: [protectString(id)] }),
				}),
			]

			return () => {
				for (const query of innerQueries) {
					query.stop()
				}
			}
		})

		return () => {
			obs1.dispose()
		}
	})

	// Set up observers:
	return [rundownsObserver]
}

export async function manipulateUISegmentPartNotesPublicationData(
	args: UISegmentPartNotesArgs,
	state: Partial<UISegmentPartNotesState>,
	collection: CustomPublishCollection<UISegmentPartNote>,
	updateProps: Partial<ReadonlyDeep<UISegmentPartNotesUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	// We know that `collection` does diffing when 'commiting' all of the changes we have made
	// meaning that for anything we will call `replace()` on, we can `remove()` it first for no extra cost

	if (updateProps?.newCache !== undefined) {
		state.contentCache = updateProps.newCache ?? undefined
	}

	if (!state.contentCache) {
		// Remove all the notes
		collection.remove(null)

		return
	}

	const updateContext = compileUpdateNotesData(state.contentCache)

	const updateAll = !updateProps || !!updateProps?.newCache
	if (updateAll) {
		// Remove all the notes
		collection.remove(null)

		state.contentCache.Segments.find({}).forEach((segment) => {
			updateNotesForSegment(args, updateContext, collection, segment)
		})
	} else {
		const regenerateForSegmentIds = new Set(updateProps.invalidateSegmentIds)

		// Figure out the Rundowns which have changed, but may not have updated the segments/parts
		const changedRundownIdsSet = new Set(updateProps.invalidateRundownIds)
		if (changedRundownIdsSet.size > 0) {
			state.contentCache.Segments.find({}).forEach((segment) => {
				if (changedRundownIdsSet.has(segment.rundownId)) {
					regenerateForSegmentIds.add(segment._id)
				}
			})
		}

		// Remove ones from segments being regenerated
		if (regenerateForSegmentIds.size > 0) {
			collection.remove((doc) => regenerateForSegmentIds.has(doc.segmentId))

			// Generate notes for each segment
			for (const segmentId of regenerateForSegmentIds) {
				const segment = state.contentCache.Segments.findOne(segmentId)

				if (segment) {
					updateNotesForSegment(args, updateContext, collection, segment)
				} else {
					// Notes have already been removed
				}
			}
		}
	}
}

interface UpdateNotesData {
	rundownsCache: Map<RundownId, Pick<Rundown, RundownFields>>
	parts: Map<SegmentId, Pick<DBPart, PartFields>[]>
	deletedPartInstances: Map<SegmentId, Pick<DBPartInstance, PartInstanceFields>[]>
}
function compileUpdateNotesData(cache: ReadonlyDeep<ContentCache>): UpdateNotesData {
	return {
		rundownsCache: normalizeArrayToMap(cache.Rundowns.find({}).fetch(), '_id'),
		parts: groupByToMap(cache.Parts.find({}).fetch(), 'segmentId'),
		deletedPartInstances: groupByToMap(cache.DeletedPartInstances.find({}).fetch(), 'segmentId'),
	}
}

function updateNotesForSegment(
	args: UISegmentPartNotesArgs,
	state: UpdateNotesData,
	collection: CustomPublishCollection<UISegmentPartNote>,
	segment: Pick<DBSegment, SegmentFields>
) {
	const notesForSegment = generateNotesForSegment(
		args.playlistId,
		segment,
		state.rundownsCache.get(segment.rundownId)?.externalNRCSName ?? 'NRCS',
		state.parts.get(segment._id) ?? [],
		state.deletedPartInstances.get(segment._id) ?? []
	)

	// Insert generated notes
	for (const note of notesForSegment) {
		collection.replace(note)
	}
}

meteorCustomPublish(
	PubSub.uiSegmentPartNotes,
	CustomCollectionName.UISegmentPartNotes,
	async function (pub, playlistId: RundownPlaylistId | null) {
		const cred = await resolveCredentials({ userId: this.userId, token: undefined })

		if (
			playlistId &&
			(!cred ||
				NoSecurityReadAccess.any() ||
				(await RundownPlaylistReadAccess.rundownPlaylistContent(playlistId, cred)))
		) {
			await setUpCollectionOptimizedObserver<
				UISegmentPartNote,
				UISegmentPartNotesArgs,
				UISegmentPartNotesState,
				UISegmentPartNotesUpdateProps
			>(
				`pub_${PubSub.uiSegmentPartNotes}_${playlistId}`,
				{ playlistId },
				setupUISegmentPartNotesPublicationObservers,
				manipulateUISegmentPartNotesPublicationData,
				pub,
				100
			)
		} else {
			logger.warn(`Pub.${CustomCollectionName.UISegmentPartNotes}: Not allowed: "${playlistId}"`)
		}
	}
)

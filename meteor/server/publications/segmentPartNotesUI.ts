import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import {
	PartId,
	PartInstanceId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { UISegmentPartNote } from '../../lib/api/rundownNotifications'
import { DBPartInstance, PartInstance, PartInstances } from '../../lib/collections/PartInstances'
import { DBPart, Parts } from '../../lib/collections/Parts'
import { Rundown, Rundowns } from '../../lib/collections/Rundowns'
import { DBSegment, Segment, SegmentOrphanedReason, Segments } from '../../lib/collections/Segments'
import {
	clone,
	generateTranslation,
	groupByToMap,
	literal,
	ProtectedString,
	protectString,
	waitForPromise,
} from '../../lib/lib'
import {
	CustomPublishCollection,
	meteorCustomPublish,
	ReactiveMongoObserverGroup,
	setUpCollectionOptimizedObserver,
	TriggerUpdate,
} from '../lib/customPublication'
import {
	updateGenericCache,
	UpdateGenericCacheResult,
	addDocsForQueryToDocMap,
} from '../lib/customPublication/updateHelper'
import { logger } from '../logging'
import { resolveCredentials } from '../security/lib/credentials'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { RundownPlaylistReadAccess } from '../security/rundownPlaylist'
import { LiveQueryHandle } from '../lib/customPublication/optimizedObserverBase'

interface UISegmentPartNotesArgs {
	readonly playlistId: RundownPlaylistId
}

interface UISegmentPartNotesState {
	rundownsCache: Map<RundownId, Pick<Rundown, RundownFields>>
	segmentCache: Map<SegmentId, Pick<DBSegment, SegmentFields>>
	partsCache: Map<PartId, Pick<DBPart, PartFields>>
	deletePartInstancesCache: Map<PartInstanceId, Pick<PartInstance, PartInstanceFields>>
}

interface UISegmentPartNotesUpdateProps {
	invalidateRundownIds: RundownId[]
	invalidateSegmentIds: SegmentId[]
	invalidatePartIds: PartId[]
	invalidatePartInstanceIds: PartInstanceId[]
}

type RundownFields = '_id' | 'playlistId' | 'externalNRCSName'
const rundownFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<RundownFields>>({
	_id: 1,
	playlistId: 1,
	externalNRCSName: 1,
})

type SegmentFields = '_id' | '_rank' | 'rundownId' | 'name' | 'notes' | 'orphaned'
const segmentFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<SegmentFields>>({
	_id: 1,
	_rank: 1,
	rundownId: 1,
	name: 1,
	notes: 1,
	orphaned: 1,
})

type PartFields = '_id' | '_rank' | 'segmentId' | 'rundownId' | 'notes' | 'title' | 'invalid' | 'invalidReason'
const partFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<PartFields>>({
	_id: 1,
	_rank: 1,
	segmentId: 1,
	rundownId: 1,
	notes: 1,
	title: 1,
	invalid: 1,
	invalidReason: 1,
})

type PartInstanceFields = '_id' | 'segmentId' | 'rundownId' | 'orphaned' | 'reset' | 'part'
const partInstanceFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<PartInstanceFields>>({
	_id: 1,
	segmentId: 1,
	rundownId: 1,
	orphaned: 1,
	reset: 1,
	// @ts-expect-error Deep not supported
	'part.title': 1,
})

async function setupUISegmentPartNotesPublicationObservers(
	args: ReadonlyDeep<UISegmentPartNotesArgs>,
	triggerUpdate: TriggerUpdate<UISegmentPartNotesUpdateProps>
): Promise<LiveQueryHandle[]> {
	const trackRundownChange = (id: RundownId): Partial<UISegmentPartNotesUpdateProps> => ({
		invalidateRundownIds: [id],
	})
	const trackSegmentChange = (id: SegmentId): Partial<UISegmentPartNotesUpdateProps> => ({
		invalidateSegmentIds: [id],
	})
	const trackPartChange = (id: PartId): Partial<UISegmentPartNotesUpdateProps> => ({
		invalidatePartIds: [id],
	})
	const trackPartInstanceChange = (id: PartInstanceId): Partial<UISegmentPartNotesUpdateProps> => ({
		invalidatePartInstanceIds: [id],
	})

	// Second level of reactivity
	const rundownContentsObserver = await ReactiveMongoObserverGroup(async () => {
		const rundownIds = (
			await Rundowns.findFetchAsync({ playlistId: args.playlistId }, { projection: { _id: 1 } })
		).map((rd) => rd._id)

		return [
			Segments.find({ rundownId: { $in: rundownIds } }, { fields: segmentFieldSpecifier }).observeChanges({
				added: (id) => triggerUpdate(trackSegmentChange(id)),
				changed: (id) => triggerUpdate(trackSegmentChange(id)),
				removed: (id) => triggerUpdate(trackSegmentChange(id)),
			}),
			Parts.find({ rundownId: { $in: rundownIds } }, { fields: partFieldSpecifier }).observeChanges({
				added: (id) => triggerUpdate(trackPartChange(id)),
				changed: (id) => triggerUpdate(trackPartChange(id)),
				removed: (id) => triggerUpdate(trackPartChange(id)),
			}),
			PartInstances.find(
				{ rundownId: { $in: rundownIds }, reset: { $ne: true }, orphaned: 'deleted' },
				{ fields: partInstanceFieldSpecifier }
			).observeChanges({
				added: (id) => triggerUpdate(trackPartInstanceChange(id)),
				changed: (id) => triggerUpdate(trackPartInstanceChange(id)),
				removed: (id) => triggerUpdate(trackPartInstanceChange(id)),
			}),
		]
	})

	// Set up observers:
	return [
		Rundowns.find({ playlistId: args.playlistId }, { fields: rundownFieldSpecifier }).observeChanges({
			added: (id) => {
				waitForPromise(rundownContentsObserver.restart())
				triggerUpdate(trackRundownChange(id))
			},
			changed: (id) => {
				// We don't need to invalidate the observer, as we get added/removed when a document matches/unmatches out query
				triggerUpdate(trackRundownChange(id))
			},
			removed: (id) => {
				waitForPromise(rundownContentsObserver.restart())
				triggerUpdate(trackRundownChange(id))
			},
		}),

		rundownContentsObserver,
	]
}

function cleanCache<TId extends ProtectedString<any>, T extends Record<string, any>, K extends keyof T>(
	key: K,
	ids: Set<TId>,
	cache: Map<any, T>
) {
	cache.forEach((part, id) => {
		if (ids.has(part[key])) {
			cache.delete(id)
		}
	})
}

async function manipulateUISegmentPartNotesPublicationData(
	args: UISegmentPartNotesArgs,
	state: Partial<UISegmentPartNotesState>,
	collection: CustomPublishCollection<UISegmentPartNote>,
	updateProps: Partial<ReadonlyDeep<UISegmentPartNotesUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	// Ensure the rundownToNRCSName map exists and is updated with any changes
	const rundownsUpdate = await updateGenericCache(
		Rundowns,
		state.rundownsCache,
		{ playlistId: args.playlistId },
		rundownFieldSpecifier,
		clone<RundownId[] | undefined>(updateProps?.invalidateRundownIds)
	)
	state.rundownsCache = rundownsUpdate.newCache

	if (rundownsUpdate.removedDocIds.length) {
		// Some rundowns were deleted, remove all matching child docs
		const rundownIdSet = new Set(rundownsUpdate.removedDocIds)

		// All caches
		if (state.partsCache) cleanCache('rundownId', rundownIdSet, state.partsCache)
		if (state.segmentCache) cleanCache('rundownId', rundownIdSet, state.segmentCache)
		if (state.deletePartInstancesCache) cleanCache('rundownId', rundownIdSet, state.deletePartInstancesCache)

		// All docs
		collection.remove((doc) => rundownIdSet.has(doc.rundownId))
	}

	// Determine which RundownIds have changed, and need to be completely regenerated
	const allRundownIds = Array.from(state.rundownsCache.keys())

	// Load any segments that have changed
	const segmentsUpdate = await updateSegmentsCache(
		state.segmentCache,
		allRundownIds,
		rundownsUpdate.addedDocIds,
		updateProps?.invalidateSegmentIds
	)
	state.segmentCache = segmentsUpdate.newCache

	if (segmentsUpdate.removedDocIds.length) {
		// Some segments were deleted, remove all matching child docs
		const segmentIdSet = new Set(segmentsUpdate.removedDocIds)

		// All caches
		if (state.partsCache) cleanCache('segmentId', segmentIdSet, state.partsCache)
		if (state.deletePartInstancesCache) cleanCache('segmentId', segmentIdSet, state.deletePartInstancesCache)

		// All docs
		collection.remove((doc) => segmentIdSet.has(doc.segmentId))
	}

	// Load any parts that have changed
	const partsUpdate = await updatePartsCache(
		state.partsCache,
		allRundownIds,
		segmentsUpdate.addedDocIds,
		updateProps?.invalidatePartIds
	)
	state.partsCache = partsUpdate.newCache

	// Load any partInstances that have changed
	const partInstanceUpdates = await updatePartInstancesCache(
		state.deletePartInstancesCache,
		allRundownIds,
		segmentsUpdate.addedDocIds,
		updateProps?.invalidatePartInstanceIds
	)
	state.deletePartInstancesCache = partInstanceUpdates.newCache

	// We know that `collection` does diffing when 'commiting' all of the changes we have made
	// meaning that for anything we will call `replace()` on, we can `remove()` it first for no extra cost

	const updateContext = compileUpdateNotesData(state.rundownsCache, state.partsCache, state.deletePartInstancesCache)

	const updateAll = !updateProps
	if (updateAll) {
		// Remove all the notes
		collection.remove(null)

		for (const segment of state.segmentCache.values()) {
			updateNotesForSegment(args, updateContext, collection, segment)
		}
	} else {
		const regenerateForSegmentIds = new Set([
			...segmentsUpdate.addedDocIds,
			...segmentsUpdate.changedDocIds,
			...partsUpdate.changedSegmentIds,
			...partInstanceUpdates.changedSegmentIds,
		])

		// Figure out the Rundowns which have changed, but may not have updated the segments/parts
		const changedRundownIdsSet = new Set(rundownsUpdate.changedDocIds)
		segmentsUpdate.newCache.forEach((segment) => {
			if (changedRundownIdsSet.has(segment.rundownId)) {
				regenerateForSegmentIds.add(segment._id)
			}
		})

		// Remove ones from segments being regenerated
		collection.remove((doc) => regenerateForSegmentIds.has(doc.segmentId))

		// Generate notes for each segment
		for (const segmentId of regenerateForSegmentIds) {
			const segment = state.segmentCache.get(segmentId)

			if (segment) {
				updateNotesForSegment(args, updateContext, collection, segment)
			} else {
				// Notes have already been removed
			}
		}
	}
}

interface UpdateNotesData {
	rundownsCache: Map<RundownId, Pick<Rundown, RundownFields>>
	parts: Map<SegmentId, Pick<DBPart, PartFields>[]>
	deletedPartInstances: Map<SegmentId, Pick<DBPartInstance, PartInstanceFields>[]>
}
function compileUpdateNotesData(
	rundownsCache: Map<RundownId, Pick<Rundown, RundownFields>>,
	partsCache: Map<PartId, Pick<DBPart, PartFields>>,
	deletePartInstancesCache: Map<PartInstanceId, Pick<DBPartInstance, PartInstanceFields>>
): UpdateNotesData {
	return {
		rundownsCache: rundownsCache,
		parts: groupByToMap(partsCache.values(), 'segmentId'),
		deletedPartInstances: groupByToMap(deletePartInstancesCache.values(), 'segmentId'),
	}
}

function updateNotesForSegment(
	args: UISegmentPartNotesArgs,
	state: UpdateNotesData,
	collection: CustomPublishCollection<UISegmentPartNote>,
	segment: Pick<DBSegment, SegmentFields>
) {
	const notesForSegment = getBasicNotesForSegment(
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

function getBasicNotesForSegment(
	playlistId: RundownPlaylistId,
	segment: Pick<Segment, SegmentFields>,
	nrcsName: string,
	parts: Pick<DBPart, PartFields>[],
	partInstances: Pick<DBPartInstance, PartInstanceFields>[]
): Array<UISegmentPartNote> {
	const notes: Array<UISegmentPartNote> = []

	if (segment.notes) {
		notes.push(
			...segment.notes.map((note, i) =>
				literal<UISegmentPartNote>({
					_id: protectString(`${segment._id}_segment_${i}`),
					playlistId,
					rundownId: segment.rundownId,
					segmentId: segment._id,
					note: {
						rank: segment._rank,
						...note,
						origin: {
							...note.origin,
							segmentId: segment._id,
							rundownId: segment.rundownId,
							name: note.origin.name || segment.name,
						},
					},
				})
			)
		)
	}

	if (segment.orphaned) {
		let message: ITranslatableMessage
		switch (segment.orphaned) {
			case SegmentOrphanedReason.DELETED:
				message = generateTranslation('Segment no longer exists in {{nrcs}}', {
					nrcs: nrcsName,
				})
				break
			case SegmentOrphanedReason.HIDDEN:
				message = generateTranslation('Segment was hidden in {{nrcs}}', {
					nrcs: nrcsName,
				})
				break
		}
		notes.push({
			_id: protectString(`${segment._id}_segment_orphaned`),
			playlistId,
			rundownId: segment.rundownId,
			segmentId: segment._id,
			note: {
				type: NoteSeverity.WARNING,
				message,
				rank: segment._rank,
				origin: {
					segmentId: segment._id,
					rundownId: segment.rundownId,
					name: segment.name,
				},
			},
		})
	} else {
		const deletedPartInstances = partInstances.filter((p) => p.orphaned === 'deleted' && !p.reset)
		if (deletedPartInstances.length > 0) {
			notes.push({
				_id: protectString(`${segment._id}_partinstances_deleted`),
				playlistId,
				rundownId: segment.rundownId,
				segmentId: segment._id,
				note: {
					type: NoteSeverity.WARNING,
					message: generateTranslation('The following parts no longer exist in {{nrcs}}: {{partNames}}', {
						nrcs: nrcsName,
						partNames: deletedPartInstances.map((p) => p.part.title).join(', '),
					}),
					rank: segment._rank,
					origin: {
						segmentId: segment._id,
						rundownId: segment.rundownId,
						name: segment.name,
					},
				},
			})
		}
	}

	for (const part of parts) {
		const commonOrigin = {
			segmentId: part.segmentId,
			partId: part._id,
			rundownId: part.rundownId,
			segmentName: segment.name,
		}

		if (part.invalidReason) {
			notes.push({
				_id: protectString(`${segment._id}_part_${part._id}_invalid`),
				playlistId,
				rundownId: segment.rundownId,
				segmentId: segment._id,
				note: {
					type: part.invalidReason.severity ?? NoteSeverity.ERROR,
					message: part.invalidReason.message,
					rank: segment._rank,
					origin: {
						...commonOrigin,
						name: part.title,
					},
				},
			})
		}

		if (part.notes && part.notes.length > 0) {
			notes.push(
				...part.notes.map((n, i) =>
					literal<UISegmentPartNote>({
						_id: protectString(`${segment._id}_part_${part._id}_${i}`),
						playlistId,
						rundownId: segment.rundownId,
						segmentId: segment._id,
						note: {
							...n,
							rank: segment._rank,
							origin: {
								...n.origin,
								...commonOrigin,
								name: n.origin.name || part.title,
							},
						},
					})
				)
			)
		}
	}

	return notes
}

async function updateSegmentsCache(
	existingMap: UISegmentPartNotesState['segmentCache'] | undefined,
	allRundownIds: RundownId[],
	addedRundownIds: RundownId[],
	changedSegmentIds: ReadonlyDeep<SegmentId[]> | undefined
): Promise<UpdateGenericCacheResult<SegmentId, Segment, SegmentFields>> {
	const result = await updateGenericCache(
		Segments,
		existingMap,
		{ rundownId: { $in: allRundownIds } },
		segmentFieldSpecifier,
		clone<SegmentId[] | undefined>(changedSegmentIds)
	)

	// Load contents of any new rundowns
	if (!result.isNew && addedRundownIds.length) {
		const allRundownIdsSet = new Set(allRundownIds)
		const filteredAddedRundownIds = addedRundownIds.filter((id) => allRundownIdsSet.has(id))

		if (filteredAddedRundownIds.length) {
			const addedIds = await addDocsForQueryToDocMap(
				Segments,
				result.newCache,
				{ rundownId: { $in: filteredAddedRundownIds } },
				segmentFieldSpecifier
			)
			result.addedDocIds.push(...addedIds)
		}
	}

	return result
}

async function updatePartsCache(
	existingMap: UISegmentPartNotesState['partsCache'] | undefined,
	allRundownIds: RundownId[],
	addedSegmentIds: SegmentId[],
	changedPartIds: ReadonlyDeep<PartId[]> | undefined
): Promise<UpdateGenericCacheResult<PartId, DBPart, PartFields> & { changedSegmentIds: SegmentId[] }> {
	const changedSegmentIds = new Set<SegmentId>()

	const docChanged = (oldDoc: Pick<DBPart, PartFields> | undefined, newDoc: Pick<DBPart, PartFields> | undefined) => {
		if (oldDoc) changedSegmentIds.add(oldDoc.segmentId)
		if (newDoc) changedSegmentIds.add(newDoc.segmentId)
	}

	const result = await updateGenericCache(
		Parts,
		existingMap,
		{ rundownId: { $in: allRundownIds } },
		segmentFieldSpecifier,
		clone<PartId[] | undefined>(changedPartIds),
		docChanged
	)

	// Load contents of any new segments
	if (!result.isNew && addedSegmentIds.length) {
		const addedIds = await addDocsForQueryToDocMap(
			Parts,
			result.newCache,
			{
				rundownId: { $in: allRundownIds },
				segmentId: { $in: addedSegmentIds },
			},
			segmentFieldSpecifier,
			docChanged
		)
		result.addedDocIds.push(...addedIds)
	}

	return { ...result, changedSegmentIds: Array.from(changedSegmentIds) }
}

async function updatePartInstancesCache(
	existingMap: UISegmentPartNotesState['deletePartInstancesCache'] | undefined,
	allRundownIds: RundownId[],
	addedSegmentIds: SegmentId[],
	changedPartInstanceIds: ReadonlyDeep<PartInstanceId[]> | undefined
): Promise<
	UpdateGenericCacheResult<PartInstanceId, PartInstance, PartInstanceFields> & { changedSegmentIds: SegmentId[] }
> {
	const changedSegmentIds = new Set<SegmentId>()

	const docChanged = (
		oldDoc: Pick<PartInstance, PartInstanceFields> | undefined,
		newDoc: Pick<PartInstance, PartInstanceFields> | undefined
	) => {
		if (oldDoc) changedSegmentIds.add(oldDoc.segmentId)
		if (newDoc) changedSegmentIds.add(newDoc.segmentId)
	}

	const result = await updateGenericCache(
		PartInstances,
		existingMap,
		{ rundownId: { $in: allRundownIds }, reset: { $ne: true }, orphaned: 'deleted' },
		segmentFieldSpecifier,
		clone<PartInstanceId[] | undefined>(changedPartInstanceIds),
		docChanged
	)

	// Load contents of any new segments
	if (!result.isNew && addedSegmentIds.length) {
		const addedIds = await addDocsForQueryToDocMap(
			PartInstances,
			result.newCache,
			{
				rundownId: { $in: allRundownIds },
				segmentId: { $in: addedSegmentIds },
				reset: { $ne: true },
				orphaned: 'deleted',
			},
			segmentFieldSpecifier,
			docChanged
		)
		result.addedDocIds.push(...addedIds)
	}

	return { ...result, changedSegmentIds: Array.from(changedSegmentIds) }
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
				pub
			)
		} else {
			logger.warn(`Pub.${CustomCollectionName.UISegmentPartNotes}: Not allowed: "${playlistId}"`)
		}
	}
)

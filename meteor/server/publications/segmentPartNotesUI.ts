import {
	PartId,
	PartInstanceId,
	RundownId,
	RundownPlaylistId,
	SegmentId,
	TriggeredActionId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { Meteor } from 'meteor/meteor'
import { Mongo } from 'meteor/mongo'
import { ReadonlyDeep } from 'type-fest'
import { CustomCollectionName, PubSub } from '../../lib/api/pubsub'
import { UISegmentPartNote, UISegmentPartNoteId } from '../../lib/api/rundownNotifications'
import { DBPartInstance, PartInstances } from '../../lib/collections/PartInstances'
import { DBPart, Parts } from '../../lib/collections/Parts'
import { RundownPlaylist, RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { Rundown, Rundowns } from '../../lib/collections/Rundowns'
import { DBSegment, Segments } from '../../lib/collections/Segments'
import { Complete, literal } from '../../lib/lib'
import { getBasicNotesForSegment } from '../../lib/rundownNotifications'
import { MongoQuery } from '../../lib/typings/meteor'
import {
	CustomPublishCollection,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
	TriggerUpdate,
} from '../lib/customPublication'
import { logger } from '../logging'
import { resolveCredentials } from '../security/lib/credentials'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { RundownPlaylistReadAccess } from '../security/rundownPlaylist'

interface UISegmentPartNotesArgs {
	readonly playlistId: RundownPlaylistId
}

interface UISegmentPartNotesState {
	rundownToNRCSName: Map<RundownId, string>
	segmentCache: Map<SegmentId, Pick<DBSegment, SegmentFields>>
	partsCache: Map<PartId, Pick<DBPart, PartFields>>
	// deletePartInstancesCache: Map<PartInstanceId, Pick<DBPartInstance, PartInstanceFields>>
}

interface UISegmentPartNotesUpdateProps {
	rundownOrderChanged: boolean
	invalidateRundownIds: RundownId[]
	invalidateSegmentIds: SegmentId[]
	invalidatePartIds: PartId[]
	invalidatePartInstanceIds: PartInstanceId[]
}

// function compileMongoSelector(
// 	showStyleBaseId: ShowStyleBaseId | null,
// 	docIds?: readonly TriggeredActionId[]
// ): Mongo.Selector<DBSegmentPartNotes> {
// 	const selector: Mongo.Selector<DBSegmentPartNotes> = { showStyleBaseId: null }
// 	if (showStyleBaseId) {
// 		selector.showStyleBaseId = { $in: [null, showStyleBaseId] }
// 	}
// 	if (docIds) {
// 		selector._id = { $in: docIds as TriggeredActionId[] }
// 	}
// 	return selector
// }

// function convertDocument(doc: DBSegmentPartNotes): UISegmentPartNote {
// 	return literal<Complete<UISegmentPartNote>>({
// 		_id: doc._id,
// 		_rank: doc._rank,

// 		showStyleBaseId: doc.showStyleBaseId,
// 		name: doc.name,

// 		actions: applyAndValidateOverrides(doc.actionsWithOverrides).obj,
// 		triggers: applyAndValidateOverrides(doc.triggersWithOverrides).obj,
// 	})
// }

type PlaylistFields = '_id' | 'rundownIdsInOrder'
const playlistFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<PlaylistFields>>({
	_id: 1,
	rundownIdsInOrder: 1,
})

type RundownFields = '_id' | 'externalNRCSName'
const rundownFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<RundownFields>>({
	_id: 1,
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

type PartInstanceFields = '_id' | 'segmentId' | 'rundownId' | 'orphaned' | 'reset' | 'part.title'
const partInstanceFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<PartInstanceFields>>({
	_id: 1,
	segmentId: 1,
	rundownId: 1,
	orphaned: 1,
	reset: 1,
	'part.title': 1,
})

async function setupUISegmentPartNotesPublicationObservers(
	args: ReadonlyDeep<UISegmentPartNotesArgs>,
	triggerUpdate: TriggerUpdate<UISegmentPartNotesUpdateProps>
): Promise<Meteor.LiveQueryHandle[]> {
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

	const rundownIds = (await Rundowns.findFetchAsync({ playlistId: args.playlistId }, { projection: { _id: 1 } })).map(
		(rd) => rd._id
	)

	// Set up observers:
	return [
		RundownPlaylists.find(args.playlistId, { fields: playlistFieldSpecifier }).observe({
			added: () => triggerUpdate({ rundownOrderChanged: true }),
			changed: () => triggerUpdate({ rundownOrderChanged: true }),
			removed: () => triggerUpdate({ rundownOrderChanged: true }),
		}),
		Rundowns.find({ playlistId: args.playlistId }, { fields: rundownFieldSpecifier }).observe({
			added: (obj) => triggerUpdate(trackRundownChange(obj._id), true),
			changed: (obj) => triggerUpdate(trackRundownChange(obj._id), true), // TODO - does this need to invalidate the observer?
			removed: (obj) => triggerUpdate(trackRundownChange(obj._id), true),
		}),
		// Second level of reactivity
		Segments.find({ rundownId: { $in: rundownIds } }, { fields: segmentFieldSpecifier }).observe({
			added: (obj) => triggerUpdate(trackSegmentChange(obj._id)),
			changed: (obj) => triggerUpdate(trackSegmentChange(obj._id)),
			removed: (obj) => triggerUpdate(trackSegmentChange(obj._id)),
		}),
		Parts.find({ rundownId: { $in: rundownIds } }, { fields: partFieldSpecifier }).observe({
			added: (obj) => triggerUpdate(trackPartChange(obj._id)),
			changed: (obj) => triggerUpdate(trackPartChange(obj._id)),
			removed: (obj) => triggerUpdate(trackPartChange(obj._id)),
		}),
		PartInstances.find(
			{ rundownId: { $in: rundownIds }, reset: { $ne: true }, orphaned: 'deleted' },
			{ fields: partInstanceFieldSpecifier }
		).observe({
			added: (obj) => triggerUpdate(trackPartInstanceChange(obj._id)),
			changed: (obj) => triggerUpdate(trackPartInstanceChange(obj._id)),
			removed: (obj) => triggerUpdate(trackPartInstanceChange(obj._id)),
		}),
	]
}
async function manipulateUISegmentPartNotesPublicationData(
	args: UISegmentPartNotesArgs,
	state: Partial<UISegmentPartNotesState>,
	collection: CustomPublishCollection<UISegmentPartNote>,
	updateProps: Partial<ReadonlyDeep<UISegmentPartNotesUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	// Ensure the rundownToNRCSName map exists and is updated with any changes
	state.rundownToNRCSName = await updateRundownToNRCSNameMap(
		args,
		state.rundownToNRCSName,
		updateProps?.invalidateRundownIds
	)

	// Determine which RundownIds have changed, and need to be completely regenerated
	const allRundownIds = Array.from(state.rundownToNRCSName.keys())
	const changedRundownIds = updateProps?.invalidateRundownIds ?? allRundownIds
	console.log(changedRundownIds)

	// Load any segments that have changed
	const [newSegmentsCache, updatedSegmentIds, reloadedSegmentIds] = await updateSegmentsCache(
		state.segmentCache,
		allRundownIds,
		changedRundownIds as RundownId[],
		updateProps?.invalidateSegmentIds
	)
	state.segmentCache = newSegmentsCache
	console.log(updatedSegmentIds, reloadedSegmentIds)

	// Load any parts that have changed
	const [newPartsCache, segmentIdsWithPartChanges] = await updatePartsCache(
		state.partsCache,
		allRundownIds,
		reloadedSegmentIds,
		updateProps?.invalidatePartIds
	)
	state.partsCache = newPartsCache
	console.log(segmentIdsWithPartChanges)

	// TODO - deletedPartInstances

	// changedPartIds tells us which Parts have potentially changed, so we can look at those to generate the notes

	// TODO - handle first run differently or if rundownRanks changed

	// Compile all the segments that may have changed that we should propogate
	const updateAll = !updateProps || !!updateProps.rundownOrderChanged
	const regenerateForSegmentIds = updateAll
		? new Set(state.segmentCache.keys())
		: new Set([
				...updatedSegmentIds,
				...reloadedSegmentIds,
				...segmentIdsWithPartChanges,
				// TODO - more?
		  ])

	const removedSegmentIds = new Set<SegmentId>()

	// Generate notes for each segment
	for (const segmentId of regenerateForSegmentIds) {
		const segment = state.segmentCache.get(segmentId)

		if (segment) {
			// TODO - optimise these lookups
			const parts = Array.from(state.partsCache.values()).filter((part) => part.segmentId === segmentId)
			const deletedPartInstances = [] //Array.from(state.partInstancesCache.values()).filter((part) => part.segmentId === segmentId)

			// TODO - rank of segment within the playlist
			const notesForSegment = getBasicNotesForSegment(
				segment,
				state.rundownToNRCSName.get(segment.rundownId) ?? 'NRCS',
				parts,
				deletedPartInstances
			)

			// Delete all removed notes
			// TODO - batch this
			const newNoteIds = new Set(notesForSegment.map((note) => note._id))
			collection.remove((doc) => doc.segmentId === segment._id && !newNoteIds.has(doc._id))

			// Insert updated notes
			for (const note of notesForSegment) {
				collection.replace({ ...note, playlistId: args.playlistId })
			}
		} else {
			// Segment no longer exists
			removedSegmentIds.add(segmentId)
		}
	}

	// Batch removal of notes from deleted segments
	if (removedSegmentIds.size > 0) {
		collection.remove((note) => removedSegmentIds.has(note.segmentId))
	}

	if (!updateProps) {
		// Populate the state with starting data
		// // First run
		// const docs = await SegmentPartNotes.findFetchAsync(compileMongoSelector(args.showStyleBaseId))
		// for (const doc of docs) {
		// 	collection.insert(convertDocument(doc))
		// }
	} else if (updateProps.invalidatePartIds && updateProps.invalidatePartIds.length > 0) {
		// const changedIds = updateProps.invalidateSegmentPartNotes
		// // Remove them from the state, so that we detect deletions
		// for (const id of changedIds) {
		// 	collection.remove(id)
		// }
		// const docs = await SegmentPartNotes.findFetchAsync(compileMongoSelector(args.showStyleBaseId, changedIds))
		// for (const doc of docs) {
		// 	collection.replace(convertDocument(doc))
		// }
	}
}

async function updateRundownToNRCSNameMap(
	args: UISegmentPartNotesArgs,
	existingMap: UISegmentPartNotesState['rundownToNRCSName'] | undefined,
	changedIds: ReadonlyDeep<RundownId[]> | undefined
): Promise<UISegmentPartNotesState['rundownToNRCSName']> {
	if (!existingMap) {
		// Ensure the rundownToNRCSName map exists

		const rundowns = (await Rundowns.findFetchAsync(
			{ playlistId: args.playlistId },
			{ projection: rundownFieldSpecifier }
		)) as Pick<Rundown, RundownFields>[]

		const newMap: UISegmentPartNotesState['rundownToNRCSName'] = new Map()
		for (const rundown of rundowns) {
			newMap.set(rundown._id, rundown.externalNRCSName)
		}

		return newMap
	}

	if (changedIds && changedIds.length > 0) {
		// Remove them from the state, so that we detect deletions
		for (const id of changedIds) {
			existingMap.delete(id)
		}
		const docs = (await Rundowns.findFetchAsync(
			{ _id: { $in: changedIds as RundownId[] }, playlistId: args.playlistId },
			{ projection: rundownFieldSpecifier }
		)) as Pick<Rundown, RundownFields>[]
		for (const doc of docs) {
			existingMap.set(doc._id, doc.externalNRCSName)
		}
	}

	return existingMap
}

async function updateSegmentsCache(
	existingMap: UISegmentPartNotesState['segmentCache'] | undefined,
	allRundownIds: RundownId[],
	changedRundownIds: RundownId[],
	changedSegmentIds: ReadonlyDeep<SegmentId[]> | undefined
): Promise<[newMap: UISegmentPartNotesState['segmentCache'], changedIds: SegmentId[], reloadedIds: SegmentId[]]> {
	// Create a fresh map
	if (!existingMap) {
		const segments = (await Segments.findFetchAsync(
			{ rundownId: { $in: allRundownIds } },
			{ projection: segmentFieldSpecifier }
		)) as Pick<DBSegment, SegmentFields>[]

		const newMap: UISegmentPartNotesState['segmentCache'] = new Map()
		for (const segment of segments) {
			newMap.set(segment._id, segment)
		}

		const allIds = segments.map((s) => s._id)
		return [newMap, allIds, allIds]
	}

	const updatedSegmentIds = new Set<SegmentId>()
	const reloadedSegmentIds = new Set<SegmentId>()

	const updateSegmentsForQuery = async (query: MongoQuery<DBSegment>) => {
		const fetchedSegmentIds = new Set<SegmentId>()
		const segments = (await Segments.findFetchAsync(query, { projection: segmentFieldSpecifier })) as Pick<
			DBSegment,
			SegmentFields
		>[]
		for (const segment of segments) {
			if (existingMap.has(segment._id)) {
				updatedSegmentIds.add(segment._id)
			} else {
				reloadedSegmentIds.add(segment._id)
			}

			existingMap.set(segment._id, segment)
			fetchedSegmentIds.add(segment._id)
		}

		return fetchedSegmentIds
	}

	// Reload Segments for any Rundowns that have changed
	if (changedRundownIds.length > 0) {
		const fetchedSegmentIds = await updateSegmentsForQuery({ rundownId: { $in: changedRundownIds } })

		// Check for deletions
		const changedRundownIdsSet = new Set(changedRundownIds)
		for (const [id, segment] of existingMap.entries()) {
			if (changedRundownIdsSet.has(segment.rundownId) && !fetchedSegmentIds.has(segment._id)) {
				reloadedSegmentIds.add(id)
				existingMap.delete(id)
			}
		}
	}

	// Reload any Segments that have changed
	if (changedSegmentIds && changedSegmentIds.length > 0) {
		const fetchedSegmentIds = await updateSegmentsForQuery({ _id: { $in: changedSegmentIds as SegmentId[] } })

		// Remove them from the cache, so that we detect deletions
		for (const id of changedSegmentIds) {
			if (!fetchedSegmentIds.has(id)) {
				// It may have changed
				reloadedSegmentIds.add(id)
				existingMap.delete(id)
			}
		}
	}

	return [existingMap, Array.from(updatedSegmentIds), Array.from(reloadedSegmentIds)]
}

async function updatePartsCache(
	existingMap: UISegmentPartNotesState['partsCache'] | undefined,
	allRundownIds: RundownId[],
	changedSegmentIds: SegmentId[],
	changedPartIds: ReadonlyDeep<PartId[]> | undefined
): Promise<[newMap: UISegmentPartNotesState['partsCache'], affectedSegmentIds: SegmentId[]]> {
	// Create a fresh map
	if (!existingMap) {
		const parts = (await Parts.findFetchAsync(
			{ rundownId: { $in: allRundownIds } },
			{ projection: partFieldSpecifier }
		)) as Pick<DBPart, PartFields>[]

		const newMap: UISegmentPartNotesState['partsCache'] = new Map()
		const affectedSegmentIds = new Set<SegmentId>()
		for (const part of parts) {
			newMap.set(part._id, part)
			affectedSegmentIds.add(part.segmentId)
		}

		return [newMap, Array.from(affectedSegmentIds)]
	}

	const affectedSegmentIds = new Set<SegmentId>()

	// Reload Segments for any Rundowns that have changed
	if (changedSegmentIds.length > 0) {
		// Remove them from the cache, so that we detect deletions
		const changedSegmentIdsSet = new Set(changedSegmentIds)
		for (const [id, part] of existingMap.entries()) {
			if (changedSegmentIdsSet.has(part.segmentId)) {
				// It may have changed
				updatedPartIds.add(id)
				existingMap.delete(id)
			}
		}

		const parts = (await Parts.findFetchAsync(
			{ segmentId: { $in: changedSegmentIds } },
			{ projection: partFieldSpecifier }
		)) as Pick<DBPart, PartFields>[]
		for (const part of parts) {
			// It may have changed
			updatedPartIds.add(part._id)
			existingMap.set(part._id, part)
		}
	}

	// Reload any Segments that have changed
	if (changedPartIds && changedPartIds.length > 0) {
		// Remove them from the cache, so that we detect deletions
		for (const id of changedPartIds) {
			// It may have changed
			updatedPartIds.add(id)
			existingMap.delete(id)
		}

		const parts = (await Parts.findFetchAsync(
			{ _id: { $in: changedPartIds as PartId[] } },
			{ projection: partFieldSpecifier }
		)) as Pick<DBPart, PartFields>[]
		for (const part of parts) {
			// It may have changed
			updatedPartIds.add(part._id)
			existingMap.set(part._id, part)
		}
	}

	return [existingMap, Array.from(affectedSegmentIds)]
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

import { PartId, RundownId, RundownPlaylistId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { check } from 'meteor/check'
import {
	CustomPublishCollection,
	TriggerUpdate,
	meteorCustomPublish,
	setUpCollectionOptimizedObserver,
} from '../../lib/customPublication'
import { logger } from '../../logging'
import { CustomCollectionName, MeteorPubSub } from '../../../lib/api/pubsub'
import { RundownPlaylistReadAccess } from '../../security/rundownPlaylist'
import { resolveCredentials } from '../../security/lib/credentials'
import { NoSecurityReadAccess } from '../../security/noSecurity'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { ContentCache, PartOmitedFields, createReactiveContentCache } from './reactiveContentCache'
import { ReadonlyDeep } from 'type-fest'
import { LiveQueryHandle } from '../../lib/lib'
import { RundownPlaylists } from '../../collections'
import { literal } from '@sofie-automation/corelib/dist/lib'
import {
	DBRundownPlaylist,
	ForceQuickLoopAutoNext,
	QuickLoopMarker,
	QuickLoopMarkerType,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { MongoFieldSpecifierOnesStrict } from '@sofie-automation/corelib/dist/mongo'
import { RundownsObserver } from '../lib/rundownsObserver'
import { RundownContentObserver } from './rundownContentObserver'
import { ProtectedString, protectString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { generateTranslation } from '../../../lib/lib'
import { DEFAULT_FALLBACK_PART_DURATION } from '@sofie-automation/shared-lib/dist/core/constants'
import { MarkerPosition, compareMarkerPositions } from '@sofie-automation/corelib/dist/playout/playlist'

interface UIPartsArgs {
	readonly playlistId: RundownPlaylistId
}

export interface UIPartsState {
	contentCache: ReadonlyDeep<ContentCache>
}

interface UIPartsUpdateProps {
	newCache: ContentCache

	invalidateRundownIds: RundownId[]
	invalidateSegmentIds: SegmentId[]
	invalidatePartIds: PartId[]

	invalidateQuickLoop: boolean
}

type RundownPlaylistFields = '_id' | 'studioId' | 'rundownIdsInOrder'
const rundownPlaylistFieldSpecifier = literal<
	MongoFieldSpecifierOnesStrict<Pick<DBRundownPlaylist, RundownPlaylistFields>>
>({
	_id: 1,
	studioId: 1,
	rundownIdsInOrder: 1,
})

async function setupUIPartsPublicationObservers(
	args: ReadonlyDeep<UIPartsArgs>,
	triggerUpdate: TriggerUpdate<UIPartsUpdateProps>
): Promise<LiveQueryHandle[]> {
	const playlist = (await RundownPlaylists.findOneAsync(args.playlistId, {
		projection: rundownPlaylistFieldSpecifier,
	})) as Pick<DBRundownPlaylist, RundownPlaylistFields> | undefined
	if (!playlist) throw new Error(`RundownPlaylist "${args.playlistId}" not found!`)

	const rundownsObserver = new RundownsObserver(playlist.studioId, playlist._id, (rundownIds) => {
		logger.silly(`Creating new RundownContentObserver`)

		const cache = createReactiveContentCache()

		// Push update
		triggerUpdate({ newCache: cache })

		const obs1 = new RundownContentObserver(playlist.studioId, playlist._id, rundownIds, cache)

		const innerQueries = [
			cache.Segments.find({}).observeChanges({
				added: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
				changed: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
				removed: (id) => triggerUpdate({ invalidateSegmentIds: [protectString(id)] }),
			}),
			cache.Parts.find({}).observeChanges({
				added: (id) => triggerUpdate({ invalidatePartIds: [protectString(id)] }),
				changed: (id) => triggerUpdate({ invalidatePartIds: [protectString(id)] }),
				removed: (id) => triggerUpdate({ invalidatePartIds: [protectString(id)] }),
			}),
			cache.RundownPlaylists.find({}).observeChanges({
				added: () => triggerUpdate({ invalidateQuickLoop: true }),
				changed: () => triggerUpdate({ invalidateQuickLoop: true }),
				removed: () => triggerUpdate({ invalidateQuickLoop: true }),
			}),
			cache.Studios.find({}).observeChanges({
				added: () => triggerUpdate({ invalidateQuickLoop: true }),
				changed: () => triggerUpdate({ invalidateQuickLoop: true }),
				removed: () => triggerUpdate({ invalidateQuickLoop: true }),
			}),
		]

		return () => {
			obs1.dispose()

			for (const query of innerQueries) {
				query.stop()
			}
		}
	})

	// Set up observers:
	return [rundownsObserver]
}

export async function manipulateUIPartsPublicationData(
	_args: UIPartsArgs,
	state: Partial<UIPartsState>,
	collection: CustomPublishCollection<DBPart>,
	updateProps: Partial<ReadonlyDeep<UIPartsUpdateProps>> | undefined
): Promise<void> {
	// Prepare data for publication:

	// We know that `collection` does diffing when 'commiting' all of the changes we have made
	// meaning that for anything we will call `replace()` on, we can `remove()` it first for no extra cost

	if (updateProps?.newCache !== undefined) {
		state.contentCache = updateProps.newCache ?? undefined
	}

	if (!state.contentCache) {
		// Remove all the parts
		collection.remove(null)

		return
	}

	const playlist = state.contentCache.RundownPlaylists.findOne({})
	if (!playlist) return

	const studio = state.contentCache.Studios.findOne({})
	if (!studio) return

	if (!playlist.quickLoop?.start || !playlist.quickLoop?.end) {
		collection.remove(null)
		state.contentCache.Parts.find({}).forEach((part) => {
			collection.replace(part)
		})
		return
	}

	collection.remove(null)

	const rundownRanks = stringsToIndexLookup(playlist.rundownIdsInOrder as unknown as string[])
	const segmentRanks = extractRanks(state.contentCache.Segments.find({}).fetch())

	const quickLoopStartPosition =
		playlist.quickLoop?.start &&
		findMarkerPosition(playlist.quickLoop.start, -Infinity, state.contentCache, rundownRanks)
	const quickLoopEndPosition =
		playlist.quickLoop?.end &&
		findMarkerPosition(playlist.quickLoop.end, Infinity, state.contentCache, rundownRanks)

	const isLoopDefined =
		playlist.quickLoop?.start && playlist.quickLoop?.end && quickLoopStartPosition && quickLoopEndPosition

	const modifyPartForQuickLoop = (part: DBPart) => {
		const partPosition = findPartPosition(part, segmentRanks, rundownRanks)
		const isLoopingOverriden =
			isLoopDefined &&
			playlist.quickLoop?.forceAutoNext !== ForceQuickLoopAutoNext.DISABLED &&
			compareMarkerPositions(quickLoopStartPosition, partPosition) >= 0 &&
			compareMarkerPositions(partPosition, quickLoopEndPosition) >= 0

		if (isLoopingOverriden && (part.expectedDuration ?? 0) <= 0) {
			if (playlist.quickLoop?.forceAutoNext === ForceQuickLoopAutoNext.ENABLED_FORCING_MIN_DURATION) {
				part.expectedDuration = studio.settings.fallbackPartDuration ?? DEFAULT_FALLBACK_PART_DURATION
				part.expectedDurationWithPreroll =
					studio.settings.fallbackPartDuration ?? DEFAULT_FALLBACK_PART_DURATION
			} else if (playlist.quickLoop?.forceAutoNext === ForceQuickLoopAutoNext.ENABLED_WHEN_VALID_DURATION) {
				part.invalid = true
				part.invalidReason = {
					message: generateTranslation('Part duration is 0.'),
				}
			}
		}
		part.autoNext = part.autoNext || (isLoopingOverriden && (part.expectedDuration ?? 0) > 0)
	}

	state.contentCache.Parts.find({}).forEach((part) => {
		modifyPartForQuickLoop(part)
		collection.replace(part)
	})
}

function findMarkerPosition(
	marker: QuickLoopMarker,
	fallback: number,
	contentCache: ReadonlyObjectDeep<ContentCache>,
	rundownRanks: Record<string, number>
): MarkerPosition {
	const part = marker.type === QuickLoopMarkerType.PART ? contentCache.Parts.findOne(marker.id) : undefined
	const partRank = part?._rank ?? fallback

	const segmentId = marker.type === QuickLoopMarkerType.SEGMENT ? marker.id : part?.segmentId
	const segment = segmentId && contentCache.Segments.findOne(segmentId)
	const segmentRank = segment?._rank ?? fallback

	const rundownId = marker.type === QuickLoopMarkerType.RUNDOWN ? marker.id : segment?.rundownId
	let rundownRank = rundownId ? rundownRanks[unprotectString(rundownId)] : fallback

	if (marker.type === QuickLoopMarkerType.PLAYLIST) rundownRank = fallback

	return {
		rundownRank: rundownRank,
		segmentRank: segmentRank,
		partRank: partRank,
	}
}

function findPartPosition(
	part: DBPart,
	segmentRanks: Record<string, number>,
	rundownRanks: Record<string, number>
): MarkerPosition {
	return {
		rundownRank: rundownRanks[part.rundownId as unknown as string] ?? 0,
		segmentRank: segmentRanks[part.segmentId as unknown as string] ?? 0,
		partRank: part._rank,
	}
}

function stringsToIndexLookup(strings: string[]): Record<string, number> {
	return strings.reduce((result, str, index) => {
		result[str] = index
		return result
	}, {} as Record<string, number>)
}

function extractRanks(docs: { _id: ProtectedString<any>; _rank: number }[]): Record<string, number> {
	return docs.reduce((result, doc) => {
		result[doc._id as unknown as string] = doc._rank
		return result
	}, {} as Record<string, number>)
}

meteorCustomPublish(
	MeteorPubSub.uiParts,
	CustomCollectionName.UIParts,
	async function (pub, playlistId: RundownPlaylistId) {
		check(playlistId, String)

		const credentials = await resolveCredentials({ userId: this.userId, token: undefined })

		if (
			!credentials ||
			NoSecurityReadAccess.any() ||
			(await RundownPlaylistReadAccess.rundownPlaylistContent(playlistId, credentials))
		) {
			await setUpCollectionOptimizedObserver<
				Omit<DBPart, PartOmitedFields>,
				UIPartsArgs,
				UIPartsState,
				UIPartsUpdateProps
			>(
				`pub_${MeteorPubSub.uiParts}_${playlistId}`,
				{ playlistId },
				setupUIPartsPublicationObservers,
				manipulateUIPartsPublicationData,
				pub
			)
		} else {
			logger.warn(`Pub.uiParts: Not allowed: "${playlistId}"`)
		}
	}
)

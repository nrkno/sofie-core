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

		const obs1 = new RundownContentObserver(playlist._id, rundownIds, cache)

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

	const playlist = state.contentCache.RundownPlaylists.find({}).fetch()[0]
	if (!playlist) return

	if (!playlist.quickLoop?.start || !playlist.quickLoop?.end) {
		collection.remove(null)
		state.contentCache.Parts.find({}).forEach((part) => {
			collection.replace(part)
		})
		return
	}

	const rundownRanks = stringsToIndexLookup(playlist.rundownIdsInOrder as unknown as string[]) // TODO: optimize by storing in state?
	const segmentRanks = extractRanks(state.contentCache.Segments.find({}).fetch()) // TODO: optimize by storing in state?

	const startPosition =
		playlist.quickLoop?.start &&
		extractMarkerPosition(playlist.quickLoop.start, -Infinity, state.contentCache, rundownRanks)
	const endPosition =
		playlist.quickLoop?.end &&
		extractMarkerPosition(playlist.quickLoop.end, Infinity, state.contentCache, rundownRanks)

	const isLoopDefined = playlist.quickLoop?.start && playlist.quickLoop?.end && startPosition && endPosition

	collection.remove(null)

	state.contentCache.Parts.find({}).forEach((part) => {
		const partPosition = extractPartPosition(part, segmentRanks, rundownRanks)
		const isLoopingOverriden =
			isLoopDefined &&
			playlist.quickLoop?.forceAutoNext !== ForceQuickLoopAutoNext.DISABLED &&
			comparePositions(startPosition, partPosition) >= 0 &&
			comparePositions(partPosition, endPosition) >= 0

		if (isLoopingOverriden && (part.expectedDuration ?? 0) <= 0) {
			if (playlist.quickLoop?.forceAutoNext === ForceQuickLoopAutoNext.ENABLED_FORCING_MIN_DURATION) {
				part.expectedDuration = 3000 // TODO: use settings
				part.expectedDurationWithPreroll = 3000
			} else if (playlist.quickLoop?.forceAutoNext === ForceQuickLoopAutoNext.ENABLED_WHEN_VALID_DURATION) {
				part.invalid = true
				part.invalidReason = {
					message: generateTranslation('Part duration is 0.'),
				}
			}
		}
		part.autoNext = part.autoNext || (isLoopingOverriden && (part.expectedDuration ?? 0) > 0)
		collection.replace(part)
	})
}

const comparePositions = (a: number[], b: number[]): number => {
	if (a[0] > b[0]) return -1
	if (a[0] < b[0]) return 1
	if (a[1] > b[1]) return -1
	if (a[1] < b[1]) return 1
	if (a[2] > b[2]) return -1
	if (a[2] < b[2]) return 1
	return 0
}

function extractMarkerPosition(
	marker: QuickLoopMarker,
	fallback: number,
	contentCache: ReadonlyObjectDeep<ContentCache>,
	rundownRanks: Record<string, number>
): [number, number, number] {
	const startPart = marker.type === QuickLoopMarkerType.PART ? contentCache.Parts.findOne(marker.id) : undefined
	const startPartRank = startPart?._rank ?? fallback

	const startSegmentId = marker.type === QuickLoopMarkerType.SEGMENT ? marker.id : startPart?.segmentId
	const startSegment = startSegmentId && contentCache.Segments.findOne(startSegmentId)
	const startSegmentRank = startSegment?._rank ?? fallback

	const startRundownId = marker.type === QuickLoopMarkerType.RUNDOWN ? marker.id : startSegment?.rundownId
	let startRundownRank = startRundownId ? rundownRanks[unprotectString(startRundownId)] : fallback

	if (marker.type === QuickLoopMarkerType.PLAYLIST) startRundownRank = fallback

	return [startRundownRank, startSegmentRank, startPartRank]
}

function extractPartPosition(
	part: DBPart,
	segmentRanks: Record<string, number>,
	rundownRanks: Record<string, number>
): [number, number, number] {
	return [
		rundownRanks[part.rundownId as unknown as string] ?? 0,
		segmentRanks[part.segmentId as unknown as string] ?? 0,
		part._rank,
	]
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

import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import {
	DBRundownPlaylist,
	ForceQuickLoopAutoNext,
	QuickLoopMarker,
	QuickLoopMarkerType,
} from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { MarkerPosition, compareMarkerPositions } from '@sofie-automation/corelib/dist/playout/playlist'
import { ProtectedString, unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { DEFAULT_FALLBACK_PART_DURATION } from '@sofie-automation/shared-lib/dist/core/constants'
import { generateTranslation } from '../../../lib/lib'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { ReactiveCacheCollection } from './ReactiveCacheCollection'

export function findPartPosition(
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

export function stringsToIndexLookup(strings: string[]): Record<string, number> {
	return strings.reduce((result, str, index) => {
		result[str] = index
		return result
	}, {} as Record<string, number>)
}

export function extractRanks(docs: { _id: ProtectedString<any>; _rank: number }[]): Record<string, number> {
	return docs.reduce((result, doc) => {
		result[doc._id as unknown as string] = doc._rank
		return result
	}, {} as Record<string, number>)
}

export function modifyPartForQuickLoop(
	part: DBPart,
	segmentRanks: Record<string, number>,
	rundownRanks: Record<string, number>,
	playlist: Pick<DBRundownPlaylist, 'quickLoop'>,
	studio: Pick<DBStudio, 'settings'>,
	quickLoopStartPosition: MarkerPosition | undefined,
	quickLoopEndPosition: MarkerPosition | undefined
): void {
	const partPosition = findPartPosition(part, segmentRanks, rundownRanks)
	const isLoopDefined = quickLoopStartPosition && quickLoopEndPosition
	const isLoopingOverriden =
		isLoopDefined &&
		playlist.quickLoop?.forceAutoNext !== ForceQuickLoopAutoNext.DISABLED &&
		compareMarkerPositions(quickLoopStartPosition, partPosition) >= 0 &&
		compareMarkerPositions(partPosition, quickLoopEndPosition) >= 0

	const fallbackPartDuration = studio.settings.fallbackPartDuration ?? DEFAULT_FALLBACK_PART_DURATION

	if (isLoopingOverriden && (part.expectedDuration ?? 0) < fallbackPartDuration) {
		if (playlist.quickLoop?.forceAutoNext === ForceQuickLoopAutoNext.ENABLED_FORCING_MIN_DURATION) {
			part.expectedDuration = fallbackPartDuration
			part.expectedDurationWithTransition = fallbackPartDuration
		} else if (playlist.quickLoop?.forceAutoNext === ForceQuickLoopAutoNext.ENABLED_WHEN_VALID_DURATION) {
			part.invalid = true
			part.invalidReason = {
				message: generateTranslation('Part duration is 0.'),
			}
		}
	}
	part.autoNext = part.autoNext || (isLoopingOverriden && (part.expectedDuration ?? 0) > 0)
}

export function findMarkerPosition(
	marker: QuickLoopMarker,
	fallback: number,
	segmentCache: ReadonlyObjectDeep<ReactiveCacheCollection<Pick<DBSegment, '_id' | '_rank' | 'rundownId'>>>,
	partCache:
		| { parts: ReadonlyObjectDeep<ReactiveCacheCollection<Pick<DBPart, '_id' | '_rank' | 'segmentId'>>> }
		| { partInstances: ReadonlyObjectDeep<ReactiveCacheCollection<DBPartInstance>> },
	rundownRanks: Record<string, number>
): MarkerPosition {
	const part =
		marker.type === QuickLoopMarkerType.PART
			? 'parts' in partCache
				? partCache.parts.findOne(marker.id)
				: partCache.partInstances.findOne({ 'part._id': marker.id })?.part
			: undefined
	const partRank = part?._rank ?? fallback

	const segmentId = marker.type === QuickLoopMarkerType.SEGMENT ? marker.id : part?.segmentId
	const segment = segmentId && segmentCache.findOne(segmentId)
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

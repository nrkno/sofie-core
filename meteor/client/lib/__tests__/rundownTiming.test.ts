import { RundownPlaylist, DBRundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PartInstance } from '../../../lib/collections/PartInstances'
import { DBPart, Part } from '../../../lib/collections/Parts'
import { DBSegment } from '../../../lib/collections/Segments'
import { DBRundown } from '../../../lib/collections/Rundowns'
import { literal, protectString } from '../../../lib/lib'
import { RundownTimingCalculator, RundownTimingContext } from '../rundownTiming'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { PartId } from '@sofie-automation/corelib/dist/dataModel/Ids'

const DEFAULT_DURATION = 4000

function makeMockPlaylist(): RundownPlaylist {
	return literal<DBRundownPlaylist>({
		_id: protectString('mock-playlist'),
		externalId: 'mock-playlist',
		organizationId: protectString('test'),
		studioId: protectString('studio0'),
		name: 'Mock Playlist',
		created: 0,
		modified: 0,
		currentPartInstanceId: null,
		nextPartInstanceId: null,
		previousPartInstanceId: null,
		timing: {
			type: PlaylistTimingType.None,
		},
		rundownIdsInOrder: [],
	})
}

function makeMockPart(
	id: string,
	rank: number,
	rundownId: string,
	segmentId: string,
	durations: {
		budgetDuration?: number
		displayDuration?: number
		displayDurationGroup?: string
		expectedDuration?: number
	}
): Part {
	return literal<DBPart>({
		_id: protectString(id),
		externalId: id,
		title: '',
		segmentId: protectString(segmentId),
		_rank: rank,
		rundownId: protectString(rundownId),
		...durations,
		expectedDurationWithPreroll: durations.expectedDuration,
	})
}

function makeMockSegment(id: string, rank: number, rundownId: string): DBSegment {
	return literal<DBSegment>({
		_id: protectString(id),
		name: 'mock-segment',
		externalId: id,
		externalModified: 0,
		_rank: rank,
		rundownId: protectString(rundownId),
	})
}

function makeMockRundown(id: string, playlist: RundownPlaylist) {
	playlist.rundownIdsInOrder.push(protectString(id))
	return literal<DBRundown>({
		_id: protectString(id),
		externalId: id,
		timing: {
			type: 'none' as any,
		},
		studioId: protectString('studio0'),
		showStyleBaseId: protectString(''),
		showStyleVariantId: protectString('variant0'),
		peripheralDeviceId: protectString(''),
		created: 0,
		modified: 0,
		importVersions: {} as any,
		name: 'test',
		externalNRCSName: 'mockNRCS',
		organizationId: protectString(''),
		playlistId: playlist._id,
	})
}

describe('rundown Timing Calculator', () => {
	it('Provides output for empty playlist', () => {
		const timing = new RundownTimingCalculator()
		const playlist: RundownPlaylist = makeMockPlaylist()
		const parts: Part[] = []
		const segments: DBSegment[] = []
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			[],
			undefined,
			parts,
			partInstancesMap,
			segments,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				isLowResolution: false,
				asDisplayedPlaylistDuration: 0,
				asPlayedPlaylistDuration: 0,
				currentPartWillAutoNext: false,
				currentTime: 0,
				rundownExpectedDurations: {},
				rundownAsPlayedDurations: {},
				partCountdown: {},
				partDisplayDurations: {},
				partDisplayStartsAt: {},
				partDurations: {},
				partExpectedDurations: {},
				partPlayed: {},
				partStartsAt: {},
				remainingPlaylistDuration: 0,
				totalPlaylistDuration: 0,
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
				segmentBudgetDurations: {},
				segmentStartedPlayback: {},
			})
		)
	})

	it('Calculates time for unplayed playlist with start time and duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: RundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedDuration: 40000,
		}
		const rundownId = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segments: DBSegment[] = []
		segments.push(makeMockSegment(segmentId1, 0, rundownId))
		segments.push(makeMockSegment(segmentId2, 0, rundownId))
		const parts: Part[] = []
		parts.push(makeMockPart('part1', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part2', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part3', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part4', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown = makeMockRundown(rundownId, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			rundowns,
			undefined,
			parts,
			partInstancesMap,
			segments,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 0,
				rundownExpectedDurations: {
					[rundownId]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId]: 4000,
				},
				partCountdown: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 0,
					part2: 0,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				remainingPlaylistDuration: 4000,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
				segmentBudgetDurations: {},
				segmentStartedPlayback: {},
			})
		)
	})

	it('Calculates time for unplayed playlist with end time and duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: RundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedDuration: 40000,
		}
		const rundownId = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segments: DBSegment[] = []
		segments.push(makeMockSegment(segmentId1, 0, rundownId))
		segments.push(makeMockSegment(segmentId2, 0, rundownId))
		const parts: Part[] = []
		parts.push(makeMockPart('part1', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part2', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part3', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part4', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown = makeMockRundown(rundownId, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			rundowns,
			undefined,
			parts,
			partInstancesMap,
			segments,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 0,
				rundownExpectedDurations: {
					[rundownId]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId]: 4000,
				},
				partCountdown: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 0,
					part2: 0,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				remainingPlaylistDuration: 4000,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
				segmentBudgetDurations: {},
				segmentStartedPlayback: {},
			})
		)
	})

	it('Produces timing per rundown with start time and duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: RundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedDuration: 40000,
		}
		const rundownId1 = 'rundown1'
		const rundownId2 = 'rundown2'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segments: DBSegment[] = []
		segments.push(makeMockSegment(segmentId1, 0, rundownId1))
		segments.push(makeMockSegment(segmentId2, 0, rundownId2))
		const parts: Part[] = []
		parts.push(makeMockPart('part1', 0, rundownId1, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part2', 0, rundownId1, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part3', 0, rundownId2, segmentId2, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part4', 0, rundownId2, segmentId2, { expectedDuration: 1000 }))
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown1 = makeMockRundown(rundownId1, playlist)
		const rundown2 = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown1, rundown2]
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			rundowns,
			undefined,
			parts,
			partInstancesMap,
			segments,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 0,
				rundownExpectedDurations: {
					[rundownId1]: 2000,
					[rundownId2]: 2000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 2000,
					[rundownId2]: 2000,
				},
				partCountdown: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 0,
					part2: 0,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				remainingPlaylistDuration: 4000,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
				segmentBudgetDurations: {},
				segmentStartedPlayback: {},
			})
		)
	})

	it('Handles display duration groups', () => {
		const timing = new RundownTimingCalculator()
		const playlist: RundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedDuration: 40000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segments: DBSegment[] = []
		segments.push(makeMockSegment(segmentId1, 0, rundownId1))
		segments.push(makeMockSegment(segmentId2, 0, rundownId1))
		const parts: Part[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
				displayDuration: 2000,
				displayDurationGroup: 'test',
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
				displayDuration: 3000,
				displayDurationGroup: 'test',
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				expectedDuration: 1000,
				displayDuration: 4000,
				displayDurationGroup: 'test',
			})
		)
		parts.push(
			makeMockPart('part4', 0, rundownId1, segmentId2, {
				expectedDuration: 1000,
				displayDuration: 5000,
				displayDurationGroup: 'test',
			})
		)
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			rundowns,
			undefined,
			parts,
			partInstancesMap,
			segments,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 0,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 4000,
				},
				partCountdown: {
					part1: 0,
					part2: 2000,
					part3: 5000,
					part4: 9000,
				},
				partDisplayDurations: {
					part1: 2000,
					part2: 3000,
					part3: 4000,
					part4: 5000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 2000,
					part3: 5000,
					part4: 9000,
				},
				partDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 0,
					part2: 0,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				remainingPlaylistDuration: 4000,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
				segmentBudgetDurations: {},
				segmentStartedPlayback: {},
			})
		)
	})

	it('Handles budget duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: RundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedDuration: 40000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segments: DBSegment[] = []
		segments.push(makeMockSegment(segmentId1, 0, rundownId1))
		segments.push(makeMockSegment(segmentId2, 0, rundownId1))
		const parts: Part[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				budgetDuration: 2000,
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				budgetDuration: 3000,
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				budgetDuration: 3000,
				expectedDuration: 1000,
			})
		)
		parts.push(makeMockPart('part4', 0, rundownId1, segmentId2, { expectedDuration: 1000 }))
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			rundowns,
			undefined,
			parts,
			partInstancesMap,
			segments,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 8000,
				currentPartWillAutoNext: false,
				currentTime: 0,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 8000,
				},
				partCountdown: {
					part1: 0,
					part2: 1000,
					part3: 5000,
					part4: 6000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				partDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 1000,
					part2: 1000,
					part3: 1000,
					part4: 1000,
				},
				partPlayed: {
					part1: 0,
					part2: 0,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				remainingPlaylistDuration: 8000,
				totalPlaylistDuration: 8000,
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
				segmentBudgetDurations: {
					[segmentId1]: 5000,
					[segmentId2]: 3000,
				},
				segmentStartedPlayback: {},
			})
		)
	})
})

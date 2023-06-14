import { RundownPlaylist, DBRundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PartInstance, wrapPartToTemporaryInstance } from '../../../lib/collections/PartInstances'
import { DBPart, Part } from '../../../lib/collections/Parts'
import { DBSegment } from '../../../lib/collections/Segments'
import { DBRundown } from '../../../lib/collections/Rundowns'
import { literal, protectString } from '../../../lib/lib'
import { RundownTimingCalculator, RundownTimingContext } from '../rundownTiming'
import { IBlueprintPieceType, PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { PartId, RundownId, SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CalculateTimingsPiece } from '@sofie-automation/corelib/dist/playout/timings'

const DEFAULT_DURATION = 0
const DEFAULT_NONZERO_DURATION = 4000

function makeMockPlaylist(): RundownPlaylist {
	return literal<DBRundownPlaylist>({
		_id: protectString('mock-playlist'),
		externalId: 'mock-playlist',
		organizationId: protectString('test'),
		studioId: protectString('studio0'),
		name: 'Mock Playlist',
		created: 0,
		modified: 0,
		currentPartInfo: null,
		nextPartInfo: null,
		previousPartInfo: null,
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

function makeMockSegment(
	id: string,
	rank: number,
	rundownId: string,
	timing?: {
		expectedStart?: number
		expectedEnd?: number
	}
): DBSegment {
	return literal<DBSegment>({
		_id: protectString(id),
		name: 'mock-segment',
		externalId: id,
		externalModified: 0,
		_rank: rank,
		rundownId: protectString(rundownId),
		segmentTiming: timing,
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
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const result = timing.updateDurations(
			0,
			false,
			playlist,
			[],
			undefined,
			parts,
			partInstancesMap,
			new Map(),
			segmentsMap,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId: null,
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
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId))
		segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId))
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
			new Map(),
			segmentsMap,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId: null,
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
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId))
		segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId))
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
			new Map(),
			segmentsMap,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId: null,
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
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId1))
		segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId2))
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
			new Map(),
			segmentsMap,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId: null,
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
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId1))
		segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId1))
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
			new Map(),
			segmentsMap,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId: null,
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

	describe('Non-zero default Part duration', () => {
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
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId))
			segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId))
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
				new Map(),
				segmentsMap,
				DEFAULT_NONZERO_DURATION,
				[]
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId: null,
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
						part1: 4000,
						part2: 4000,
						part3: 4000,
						part4: 4000,
					},
					partDisplayStartsAt: {
						part1: 0,
						part2: 4000,
						part3: 8000,
						part4: 12000,
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
			const segmentsMap: Map<SegmentId, DBSegment> = new Map()
			segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId1))
			segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId1))
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
			parts.push(
				makeMockPart('part5', 0, rundownId1, segmentId2, {
					expectedDuration: 1000,
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
				new Map(),
				segmentsMap,
				DEFAULT_NONZERO_DURATION,
				[]
			)
			expect(result).toEqual(
				literal<RundownTimingContext>({
					currentPartInstanceId: null,
					isLowResolution: false,
					asDisplayedPlaylistDuration: 5000,
					asPlayedPlaylistDuration: 5000,
					currentPartWillAutoNext: false,
					currentTime: 0,
					rundownExpectedDurations: {
						[rundownId1]: 5000,
					},
					rundownAsPlayedDurations: {
						[rundownId1]: 5000,
					},
					partCountdown: {
						part1: 0,
						part2: 2000,
						part3: 5000,
						part4: 9000,
						part5: 14000,
					},
					partDisplayDurations: {
						part1: 2000,
						part2: 3000,
						part3: 4000,
						part4: 5000,
						part5: 4000,
					},
					partDisplayStartsAt: {
						part1: 0,
						part2: 2000,
						part3: 5000,
						part4: 9000,
						part5: 14000,
					},
					partDurations: {
						part1: 1000,
						part2: 1000,
						part3: 1000,
						part4: 1000,
						part5: 1000,
					},
					partExpectedDurations: {
						part1: 1000,
						part2: 1000,
						part3: 1000,
						part4: 1000,
						part5: 1000,
					},
					partPlayed: {
						part1: 0,
						part2: 0,
						part3: 0,
						part4: 0,
						part5: 0,
					},
					partStartsAt: {
						part1: 0,
						part2: 1000,
						part3: 2000,
						part4: 3000,
						part5: 4000,
					},
					remainingPlaylistDuration: 5000,
					totalPlaylistDuration: 5000,
					breakIsLastRundown: undefined,
					remainingTimeOnCurrentPart: undefined,
					rundownsBeforeNextBreak: undefined,
					segmentBudgetDurations: {},
					segmentStartedPlayback: {},
				})
			)
		})
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
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId1))
		segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId1))
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
			new Map(),
			segmentsMap,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId: null,
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

	it('Adds Piece preroll to Part durations', () => {
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
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(protectString<SegmentId>(segmentId1), makeMockSegment(segmentId1, 0, rundownId))
		segmentsMap.set(protectString<SegmentId>(segmentId2), makeMockSegment(segmentId2, 0, rundownId))
		const parts: Part[] = []
		parts.push(makeMockPart('part1', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part2', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part3', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part4', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
		const piecesMap: Map<PartId, CalculateTimingsPiece[]> = new Map()
		piecesMap.set(protectString('part1'), [
			literal<CalculateTimingsPiece>({
				enable: {
					start: 0,
				},
				prerollDuration: 5000,
				pieceType: IBlueprintPieceType.Normal,
			}),
		])
		piecesMap.set(protectString('part2'), [
			literal<CalculateTimingsPiece>({
				enable: {
					start: 0,
				},
				prerollDuration: 240,
				pieceType: IBlueprintPieceType.Normal,
			}),
		])
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
			piecesMap,
			segmentsMap,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				isLowResolution: false,
				asDisplayedPlaylistDuration: 9240,
				asPlayedPlaylistDuration: 9240,
				currentPartInstanceId: null,
				currentPartWillAutoNext: false,
				currentTime: 0,
				rundownExpectedDurations: {
					[rundownId]: 9240,
				},
				rundownAsPlayedDurations: {
					[rundownId]: 9240,
				},
				partCountdown: {
					part1: 0,
					part2: 6000,
					part3: 7240,
					part4: 8240,
				},
				partDisplayDurations: {
					part1: 6000,
					part2: 1240,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 6000,
					part3: 7240,
					part4: 8240,
				},
				partDurations: {
					part1: 6000,
					part2: 1240,
					part3: 1000,
					part4: 1000,
				},
				partExpectedDurations: {
					part1: 6000,
					part2: 1240,
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
					part2: 6000,
					part3: 7240,
					part4: 8240,
				},
				remainingPlaylistDuration: 9240,
				totalPlaylistDuration: 9240,
				breakIsLastRundown: undefined,
				remainingTimeOnCurrentPart: undefined,
				rundownsBeforeNextBreak: undefined,
				segmentBudgetDurations: {},
				segmentStartedPlayback: {},
			})
		)
	})

	it('Back-time: Can find the next expectedStart rundown anchor when it is in a future segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: RundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'back-time' as any,
			expectedDuration: 4000,
			expectedEnd: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 4000 })
		)
		const parts: Part[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				expectedDuration: 1000,
			})
		)
		parts.push(makeMockPart('part4', 0, rundownId1, segmentId2, { expectedDuration: 1000 }))
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			take: 1000,
			plannedStartedPlayback: 1000,
		}
		const currentPartInstanceId = partInstancesMap.get(parts[1]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
		playlist.currentPartInfo = {
			partInstanceId: currentPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesNextSegmentId: false,
		}
		playlist.nextPartInfo = {
			partInstanceId: nextPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesNextSegmentId: false,
		}
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			1500,
			false,
			playlist,
			rundowns,
			rundown,
			parts,
			partInstancesMap,
			new Map(),
			segmentsMap,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 1500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 4000,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: 500,
					part4: 1500,
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
					part1: 1000,
					part2: 500,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				remainingPlaylistDuration: 2500,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: 500,
				rundownsBeforeNextBreak: [],
				segmentBudgetDurations: {},
				segmentStartedPlayback: {},
				nextRundownAnchor: 2000,
			})
		)
	})

	it('Back-time: Can find the next expectedEnd rundown anchor when it is a future segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: RundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'back-time' as any,
			expectedDuration: 4000,
			expectedEnd: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 4000 })
		)
		const parts: Part[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				expectedDuration: 1000,
			})
		)
		parts.push(makeMockPart('part4', 0, rundownId1, segmentId2, { expectedDuration: 1000 }))
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			take: 1000,
			plannedStartedPlayback: 1000,
		}
		const currentPartInstanceId = partInstancesMap.get(parts[1]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
		playlist.currentPartInfo = {
			partInstanceId: currentPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesNextSegmentId: false,
		}
		playlist.nextPartInfo = {
			partInstanceId: nextPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesNextSegmentId: false,
		}
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			3500,
			false,
			playlist,
			rundowns,
			rundown,
			parts,
			partInstancesMap,
			new Map(),
			segmentsMap,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 5500,
				asPlayedPlaylistDuration: 5500,
				currentPartWillAutoNext: false,
				currentTime: 3500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 5500,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: 0,
					part4: 1000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 2500,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 3500,
					part4: 4500,
				},
				partDurations: {
					part1: 1000,
					part2: 2500,
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
					part1: 1000,
					part2: 2500,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 3500,
					part4: 4500,
				},
				remainingPlaylistDuration: 2000,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: -1500,
				rundownsBeforeNextBreak: [],
				segmentBudgetDurations: {},
				segmentStartedPlayback: {},
				nextRundownAnchor: 4000,
			})
		)
	})

	it('Back-time: Can find the next expectedEnd rundown anchor when it is the current segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: RundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'back-time' as any,
			expectedDuration: 4000,
			expectedEnd: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 3000 })
		)
		const parts: Part[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				expectedDuration: 1000,
			})
		)
		parts.push(makeMockPart('part4', 0, rundownId1, segmentId2, { expectedDuration: 1000 }))
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			duration: 1000,
			take: 1000,
			plannedStartedPlayback: 1000,
			plannedStoppedPlayback: 2000,
		}
		partInstancesMap.get(parts[2]._id)!.timings = {
			take: 2000,
			plannedStartedPlayback: 2000,
		}
		const currentPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[3]._id)!._id
		playlist.currentPartInfo = {
			partInstanceId: currentPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesNextSegmentId: false,
		}
		playlist.nextPartInfo = {
			partInstanceId: nextPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesNextSegmentId: false,
		}
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			2500,
			false,
			playlist,
			rundowns,
			rundown,
			parts,
			partInstancesMap,
			new Map(),
			segmentsMap,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 2500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 4000,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: null,
					part4: 500,
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
					part1: 1000,
					part2: 1000,
					part3: 500,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				remainingPlaylistDuration: 1500,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: 500,
				rundownsBeforeNextBreak: [],
				segmentBudgetDurations: {},
				segmentStartedPlayback: {},
				nextRundownAnchor: 3000,
			})
		)
	})

	it('Forward-time: Can find the next expectedStart rundown anchor when it is in a future segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: RundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedDuration: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 4000 })
		)
		const parts: Part[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				expectedDuration: 1000,
			})
		)
		parts.push(makeMockPart('part4', 0, rundownId1, segmentId2, { expectedDuration: 1000 }))
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			take: 1000,
			plannedStartedPlayback: 1000,
		}
		const currentPartInstanceId = partInstancesMap.get(parts[1]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
		playlist.currentPartInfo = {
			partInstanceId: currentPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesNextSegmentId: false,
		}
		playlist.nextPartInfo = {
			partInstanceId: nextPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesNextSegmentId: false,
		}
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			1500,
			false,
			playlist,
			rundowns,
			rundown,
			parts,
			partInstancesMap,
			new Map(),
			segmentsMap,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 1500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 4000,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: 500,
					part4: 1500,
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
					part1: 1000,
					part2: 500,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				remainingPlaylistDuration: 2500,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: 500,
				rundownsBeforeNextBreak: [],
				segmentBudgetDurations: {},
				segmentStartedPlayback: {},
				nextRundownAnchor: 2000,
			})
		)
	})

	it('Forward-time: Can find the next expectedEnd rundown anchor when it is a future segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: RundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedDuration: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 4000 })
		)
		const parts: Part[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				expectedDuration: 1000,
			})
		)
		parts.push(makeMockPart('part4', 0, rundownId1, segmentId2, { expectedDuration: 1000 }))
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			take: 1000,
			plannedStartedPlayback: 1000,
		}
		const currentPartInstanceId = partInstancesMap.get(parts[1]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
		playlist.currentPartInfo = {
			partInstanceId: currentPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesNextSegmentId: false,
		}
		playlist.nextPartInfo = {
			partInstanceId: nextPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesNextSegmentId: false,
		}
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			3500,
			false,
			playlist,
			rundowns,
			rundown,
			parts,
			partInstancesMap,
			new Map(),
			segmentsMap,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 5500,
				asPlayedPlaylistDuration: 5500,
				currentPartWillAutoNext: false,
				currentTime: 3500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 5500,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: 0,
					part4: 1000,
				},
				partDisplayDurations: {
					part1: 1000,
					part2: 2500,
					part3: 1000,
					part4: 1000,
				},
				partDisplayStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 3500,
					part4: 4500,
				},
				partDurations: {
					part1: 1000,
					part2: 2500,
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
					part1: 1000,
					part2: 2500,
					part3: 0,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 3500,
					part4: 4500,
				},
				remainingPlaylistDuration: 2000,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: -1500,
				rundownsBeforeNextBreak: [],
				segmentBudgetDurations: {},
				segmentStartedPlayback: {},
				nextRundownAnchor: 4000,
			})
		)
	})

	it('Forward-time: Can find the next expectedEnd rundown anchor when it is the current segment', () => {
		const timing = new RundownTimingCalculator()
		const playlist: RundownPlaylist = makeMockPlaylist()
		playlist.timing = {
			type: 'forward-time' as any,
			expectedStart: 0,
			expectedEnd: 4000,
		}
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const segmentsMap: Map<SegmentId, DBSegment> = new Map()
		segmentsMap.set(
			protectString<SegmentId>(segmentId1),
			makeMockSegment(segmentId1, 0, rundownId1, { expectedStart: 0 })
		)
		segmentsMap.set(
			protectString<SegmentId>(segmentId2),
			makeMockSegment(segmentId2, 0, rundownId1, { expectedStart: 2000, expectedEnd: 3000 })
		)
		const parts: Part[] = []
		parts.push(
			makeMockPart('part1', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part2', 0, rundownId1, segmentId1, {
				expectedDuration: 1000,
			})
		)
		parts.push(
			makeMockPart('part3', 0, rundownId1, segmentId2, {
				expectedDuration: 1000,
			})
		)
		parts.push(makeMockPart('part4', 0, rundownId1, segmentId2, { expectedDuration: 1000 }))
		const partInstancesMap: Map<PartId, PartInstance> = new Map(
			parts.map((part) => {
				return [part._id, wrapPartToTemporaryInstance(protectString('active'), part)]
			})
		)
		partInstancesMap.get(parts[0]._id)!.timings = {
			duration: 1000,
			take: 0,
			plannedStartedPlayback: 0,
			plannedStoppedPlayback: 1000,
		}
		partInstancesMap.get(parts[1]._id)!.timings = {
			duration: 1000,
			take: 1000,
			plannedStartedPlayback: 1000,
			plannedStoppedPlayback: 2000,
		}
		partInstancesMap.get(parts[2]._id)!.timings = {
			take: 2000,
			plannedStartedPlayback: 2000,
		}
		const currentPartInstanceId = partInstancesMap.get(parts[2]._id)!._id
		const nextPartInstanceId = partInstancesMap.get(parts[3]._id)!._id
		playlist.currentPartInfo = {
			partInstanceId: currentPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesNextSegmentId: false,
		}
		playlist.nextPartInfo = {
			partInstanceId: nextPartInstanceId,
			rundownId: protectString<RundownId>(rundownId1),
			manuallySelected: false,
			consumesNextSegmentId: false,
		}
		const rundown = makeMockRundown(rundownId1, playlist)
		const rundowns = [rundown]
		const result = timing.updateDurations(
			2500,
			false,
			playlist,
			rundowns,
			rundown,
			parts,
			partInstancesMap,
			new Map(),
			segmentsMap,
			DEFAULT_DURATION,
			[]
		)
		expect(result).toEqual(
			literal<RundownTimingContext>({
				currentPartInstanceId,
				isLowResolution: false,
				asDisplayedPlaylistDuration: 4000,
				asPlayedPlaylistDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 2500,
				rundownExpectedDurations: {
					[rundownId1]: 4000,
				},
				rundownAsPlayedDurations: {
					[rundownId1]: 4000,
				},
				partCountdown: {
					part1: null,
					part2: null,
					part3: null,
					part4: 500,
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
					part1: 1000,
					part2: 1000,
					part3: 500,
					part4: 0,
				},
				partStartsAt: {
					part1: 0,
					part2: 1000,
					part3: 2000,
					part4: 3000,
				},
				remainingPlaylistDuration: 1500,
				totalPlaylistDuration: 4000,
				breakIsLastRundown: false,
				remainingTimeOnCurrentPart: 500,
				rundownsBeforeNextBreak: [],
				segmentBudgetDurations: {},
				segmentStartedPlayback: {},
				nextRundownAnchor: 3000,
			})
		)
	})
})

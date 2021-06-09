import { PartInstance } from '../../collections/PartInstances'
import { DBPart, Part, PartId } from '../../collections/Parts'
import { DBRundownPlaylist, RundownPlaylist } from '../../collections/RundownPlaylists'
import { literal, protectString } from '../../lib'
import { RundownTiming, RundownTimingCalculator } from '../rundownTiming'

const DEFAULT_DURATION = 4000

function makeMockPlaylist(): RundownPlaylist {
	return new RundownPlaylist(
		literal<DBRundownPlaylist>({
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
		})
	)
}

function makeMockPart(
	id: string,
	rank: number,
	rundownId: string,
	segmentId: string,
	durations: { expectedDuration?: number; displayDuration?: number; displayDurationGroup?: string }
): Part {
	return new Part(
		literal<DBPart>({
			_id: protectString(id),
			externalId: id,
			title: '',
			segmentId: protectString(segmentId),
			_rank: rank,
			rundownId: protectString(rundownId),
			...durations,
		})
	)
}

describe('rundown Timing Calculator', () => {
	it('Provides output for empty playlist', () => {
		const timing = new RundownTimingCalculator()
		const playlist: RundownPlaylist = makeMockPlaylist()
		const parts: Part[] = []
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const result = timing.updateDurations(0, false, playlist, parts, partInstancesMap, DEFAULT_DURATION)
		expect(result).toEqual(
			literal<RundownTiming.RundownTimingContext>({
				isLowResolution: false,
				asDisplayedRundownDuration: 0,
				asPlayedRundownDuration: 0,
				currentPartWillAutoNext: false,
				currentTime: 0,
				partCountdown: {},
				partDisplayDurations: {},
				partDisplayStartsAt: {},
				partDurations: {},
				partExpectedDurations: {},
				partPlayed: {},
				partStartsAt: {},
				remainingRundownDuration: 0,
				totalRundownDuration: 0,
			})
		)
	})

	it('Calculates time for unplayed playlist with start time and duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: RundownPlaylist = makeMockPlaylist()
		playlist.expectedStart = 0
		playlist.expectedDuration = 4000
		const rundownId = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const parts: Part[] = []
		parts.push(makeMockPart('part1', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part2', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part3', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part4', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const result = timing.updateDurations(0, false, playlist, parts, partInstancesMap, DEFAULT_DURATION)
		expect(result).toEqual(
			literal<RundownTiming.RundownTimingContext>({
				isLowResolution: false,
				asDisplayedRundownDuration: 4000,
				asPlayedRundownDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 0,
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
				remainingRundownDuration: 4000,
				totalRundownDuration: 4000,
			})
		)
	})

	it('Calculates time for unplayed playlist with end time and duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: RundownPlaylist = makeMockPlaylist()
		playlist.expectedDuration = 4000
		playlist.expectedEnd = 4000
		const rundownId = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const parts: Part[] = []
		parts.push(makeMockPart('part1', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part2', 0, rundownId, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part3', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part4', 0, rundownId, segmentId2, { expectedDuration: 1000 }))
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const result = timing.updateDurations(0, false, playlist, parts, partInstancesMap, DEFAULT_DURATION)
		expect(result).toEqual(
			literal<RundownTiming.RundownTimingContext>({
				isLowResolution: false,
				asDisplayedRundownDuration: 4000,
				asPlayedRundownDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 0,
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
				remainingRundownDuration: 4000,
				totalRundownDuration: 4000,
			})
		)
	})

	it('Produces timing per rundown with start time and duration', () => {
		const timing = new RundownTimingCalculator()
		const playlist: RundownPlaylist = makeMockPlaylist()
		playlist.expectedStart = 0
		playlist.expectedDuration = 4000
		const rundownId1 = 'rundown1'
		const rundownId2 = 'rundown2'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
		const parts: Part[] = []
		parts.push(makeMockPart('part1', 0, rundownId1, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part2', 0, rundownId1, segmentId1, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part3', 0, rundownId2, segmentId2, { expectedDuration: 1000 }))
		parts.push(makeMockPart('part4', 0, rundownId2, segmentId2, { expectedDuration: 1000 }))
		const partInstancesMap: Map<PartId, PartInstance> = new Map()
		const result = timing.updateDurations(0, false, playlist, parts, partInstancesMap, DEFAULT_DURATION)
		expect(result).toEqual(
			literal<RundownTiming.RundownTimingContext>({
				isLowResolution: false,
				asDisplayedRundownDuration: 4000,
				asPlayedRundownDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 0,
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
				remainingRundownDuration: 4000,
				totalRundownDuration: 4000,
			})
		)
	})

	it('Handles display duration groups', () => {
		const timing = new RundownTimingCalculator()
		const playlist: RundownPlaylist = makeMockPlaylist()
		playlist.expectedStart = 0
		playlist.expectedDuration = 4000
		const rundownId1 = 'rundown1'
		const segmentId1 = 'segment1'
		const segmentId2 = 'segment2'
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
		const result = timing.updateDurations(0, false, playlist, parts, partInstancesMap, DEFAULT_DURATION)
		expect(result).toEqual(
			literal<RundownTiming.RundownTimingContext>({
				isLowResolution: false,
				asDisplayedRundownDuration: 4000,
				asPlayedRundownDuration: 4000,
				currentPartWillAutoNext: false,
				currentTime: 0,
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
				remainingRundownDuration: 4000,
				totalRundownDuration: 4000,
			})
		)
	})
})

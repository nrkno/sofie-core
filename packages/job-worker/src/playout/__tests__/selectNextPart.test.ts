import { SegmentId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'
import { PlayoutSegmentModelImpl } from '../model/implementation/PlayoutSegmentModelImpl'
import { PlayoutSegmentModel } from '../model/PlayoutSegmentModel'
import { selectNextPart } from '../selectNextPart'

class MockPart {
	constructor(
		public _id: string,
		public _rank: number,
		public segmentId: SegmentId,
		public playable: boolean = true
	) {}

	get invalid(): boolean {
		return !this.playable
	}

	toPartInstance() {
		return {
			part: this,
			segmentId: this.segmentId,
		} as unknown as DBPartInstance
	}
}
class MockSegment {
	constructor(public _id: SegmentId, public _rank: number) {}
}

describe('selectNextPart', () => {
	let context: MockJobContext
	let defaultPlaylist: Parameters<typeof selectNextPart>[1]

	const segment1: SegmentId = protectString('segment1')
	const segment2: SegmentId = protectString('segment2')
	const segment3: SegmentId = protectString('segment3')

	let defaultParts: MockPart[]
	let defaultSegments: MockSegment[]

	beforeEach(() => {
		context = setupDefaultJobEnvironment()

		defaultPlaylist = {
			queuedSegmentId: undefined,
			loop: false,
		}

		defaultParts = [
			new MockPart('part1', 1, segment1),
			new MockPart('part2', 2, segment1),
			new MockPart('part3', 3, segment1),
			new MockPart('part4', 4, segment2, false),
			new MockPart('part5', 5, segment2),
			new MockPart('part6', 6, segment2),
			new MockPart('part7', 7, segment3),
			new MockPart('part8', 8, segment3, false),
			new MockPart('part9', 9, segment3),
		]
		defaultSegments = [new MockSegment(segment1, 1), new MockSegment(segment2, 2), new MockSegment(segment3, 3)]
	})

	function selectNextPart2(
		previousPartInstance: ReadonlyDeep<DBPartInstance> | null,
		currentlySelectedPartInstance: ReadonlyDeep<DBPartInstance> | null,
		ignoreUnplayabale = true
	) {
		const parts = [...(defaultParts as unknown as DBPart[])]
		const segments: readonly PlayoutSegmentModel[] = defaultSegments.map(
			(segment) =>
				new PlayoutSegmentModelImpl(
					segment as unknown as DBSegment,
					parts.filter((p) => p.segmentId === segment._id)
				)
		)

		return selectNextPart(
			context,
			defaultPlaylist,
			previousPartInstance,
			currentlySelectedPartInstance,
			segments,
			parts,
			ignoreUnplayabale
		)
	}

	test('from nothing', () => {
		{
			// default
			const nextPart = selectNextPart2(null, null)
			expect(nextPart).toEqual({ index: 0, part: defaultParts[0], consumesQueuedSegmentId: false })
		}

		{
			// first isnt playable
			defaultParts[0].playable = false
			const nextPart = selectNextPart2(null, null)
			expect(nextPart).toEqual({ index: 1, part: defaultParts[1], consumesQueuedSegmentId: false })
		}

		{
			// nextSegmentId is set
			defaultPlaylist.queuedSegmentId = segment3
			const nextPart = selectNextPart2(null, null)
			expect(nextPart).toEqual({ index: 6, part: defaultParts[6], consumesQueuedSegmentId: true })
		}

		{
			// nextSegmentId is set (and first there isnt playable)
			defaultPlaylist.queuedSegmentId = segment2
			const nextPart = selectNextPart2(null, null)
			expect(nextPart).toEqual({ index: 4, part: defaultParts[4], consumesQueuedSegmentId: true })
		}
	})

	test('from nothing - allow unplayable', () => {
		{
			// default
			const nextPart = selectNextPart2(null, null, false)
			expect(nextPart).toEqual({ index: 0, part: defaultParts[0], consumesQueuedSegmentId: false })
		}

		{
			// first isnt playable
			defaultParts[0].playable = false
			const nextPart = selectNextPart2(null, null, false)
			expect(nextPart).toEqual({ index: 0, part: defaultParts[0], consumesQueuedSegmentId: false })
		}

		{
			// nextSegmentId is set
			defaultPlaylist.queuedSegmentId = segment3
			const nextPart = selectNextPart2(null, null, false)
			expect(nextPart).toEqual({ index: 6, part: defaultParts[6], consumesQueuedSegmentId: true })
		}

		{
			// nextSegmentId is set (and first there isnt playable)
			defaultPlaylist.queuedSegmentId = segment2
			const nextPart = selectNextPart2(null, null, false)
			expect(nextPart).toEqual({ index: 3, part: defaultParts[3], consumesQueuedSegmentId: true })
		}
	})

	test('from partInstance', () => {
		const previousPartInstance = defaultParts[4].toPartInstance()
		{
			// default
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 5, part: defaultParts[5], consumesQueuedSegmentId: false })
		}

		{
			// next isnt playable
			defaultParts[5].playable = false
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 6, part: defaultParts[6], consumesQueuedSegmentId: false })
		}

		{
			// queuedSegmentId is set
			defaultParts[0].playable = false
			defaultPlaylist.queuedSegmentId = segment1
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 1, part: defaultParts[1], consumesQueuedSegmentId: true })
		}

		{
			// nextSegmentId is set (and first there isnt playable)
			defaultPlaylist.queuedSegmentId = segment2
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 4, part: defaultParts[4], consumesQueuedSegmentId: true })
		}
	})

	test('from partInstance - orphaned', () => {
		const previousPartInstance = defaultParts[4].toPartInstance()
		defaultParts.splice(4, 1)
		previousPartInstance.orphaned = 'deleted'

		{
			// single part is orphaned
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 4, part: defaultParts[4], consumesQueuedSegmentId: false })
		}

		{
			// whole segment is orphaned/deleted
			defaultParts = defaultParts.filter((p) => p.segmentId !== previousPartInstance.segmentId)
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 3, part: defaultParts[3], consumesQueuedSegmentId: false })
		}

		{
			// no parts after
			defaultParts = defaultParts.filter((p) => p.segmentId !== segment3)
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual(null)
		}

		{
			// no parts after, but looping
			defaultPlaylist.loop = true
			defaultParts = defaultParts.filter((p) => p.segmentId !== segment3)
			const nextPart = selectNextPart2(previousPartInstance, null)
			expect(nextPart).toEqual({ index: 0, part: defaultParts[0], consumesQueuedSegmentId: false })
		}
	})

	test('from partInstance - allow unplayable', () => {
		const previousPartInstance = defaultParts[4].toPartInstance()
		{
			// default
			const nextPart = selectNextPart2(previousPartInstance, null, false)
			expect(nextPart).toEqual({ index: 5, part: defaultParts[5], consumesQueuedSegmentId: false })
		}

		{
			// next isnt playable
			defaultParts[5].playable = false
			const nextPart = selectNextPart2(previousPartInstance, null, false)
			expect(nextPart).toEqual({ index: 5, part: defaultParts[5], consumesQueuedSegmentId: false })
		}
	})
})

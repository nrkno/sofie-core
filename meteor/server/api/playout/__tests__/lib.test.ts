import { PartInstance } from '../../../../lib/collections/PartInstances'
import { Part } from '../../../../lib/collections/Parts'
import { SegmentId } from '../../../../lib/collections/Segments'
import { protectString } from '../../../../lib/lib'
import { selectNextPart } from '../lib'

class MockPart {
	constructor(
		public _id: string,
		public _rank: number,
		public segmentId: SegmentId,
		public playable: boolean = true
	) {}

	isPlayable() {
		return this.playable
	}

	toPartInstance() {
		return ({
			part: this,
			segmentId: this.segmentId,
		} as unknown) as PartInstance
	}
}

describe('selectNextPart', () => {
	let defaultPlaylist: Parameters<typeof selectNextPart>[0]

	const segment1: SegmentId = protectString('segment1')
	const segment2: SegmentId = protectString('segment2')
	const segment3: SegmentId = protectString('segment3')

	let defaultParts: MockPart[]

	beforeEach(() => {
		defaultPlaylist = {
			nextSegmentId: undefined,
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
	})

	test('from nothing', () => {
		{
			// default
			const nextPart = selectNextPart(defaultPlaylist, null, (defaultParts as unknown) as Part[])
			expect(nextPart).toEqual({ index: 0, part: defaultParts[0] })
		}

		{
			// first isnt playable
			defaultParts[0].playable = false
			const nextPart = selectNextPart(defaultPlaylist, null, (defaultParts as unknown) as Part[])
			expect(nextPart).toEqual({ index: 1, part: defaultParts[1] })
		}

		{
			// nextSegmentId is set
			defaultPlaylist.nextSegmentId = segment3
			const nextPart = selectNextPart(defaultPlaylist, null, (defaultParts as unknown) as Part[])
			expect(nextPart).toEqual({ index: 6, part: defaultParts[6], consumesNextSegmentId: true })
		}

		{
			// nextSegmentId is set (and first there isnt playable)
			defaultPlaylist.nextSegmentId = segment2
			const nextPart = selectNextPart(defaultPlaylist, null, (defaultParts as unknown) as Part[])
			expect(nextPart).toEqual({ index: 4, part: defaultParts[4], consumesNextSegmentId: true })
		}
	})

	test('from nothing - allow unplayable', () => {
		{
			// default
			const nextPart = selectNextPart(defaultPlaylist, null, (defaultParts as unknown) as Part[], false)
			expect(nextPart).toEqual({ index: 0, part: defaultParts[0] })
		}

		{
			// first isnt playable
			defaultParts[0].playable = false
			const nextPart = selectNextPart(defaultPlaylist, null, (defaultParts as unknown) as Part[], false)
			expect(nextPart).toEqual({ index: 0, part: defaultParts[0] })
		}

		{
			// nextSegmentId is set
			defaultPlaylist.nextSegmentId = segment3
			const nextPart = selectNextPart(defaultPlaylist, null, (defaultParts as unknown) as Part[], false)
			expect(nextPart).toEqual({ index: 6, part: defaultParts[6], consumesNextSegmentId: true })
		}

		{
			// nextSegmentId is set (and first there isnt playable)
			defaultPlaylist.nextSegmentId = segment2
			const nextPart = selectNextPart(defaultPlaylist, null, (defaultParts as unknown) as Part[], false)
			expect(nextPart).toEqual({ index: 3, part: defaultParts[3], consumesNextSegmentId: true })
		}
	})

	test('from partInstance', () => {
		const previousPartInstance = defaultParts[4].toPartInstance()
		{
			// default
			const nextPart = selectNextPart(defaultPlaylist, previousPartInstance, (defaultParts as unknown) as Part[])
			expect(nextPart).toEqual({ index: 5, part: defaultParts[5] })
		}

		{
			// next isnt playable
			defaultParts[5].playable = false
			const nextPart = selectNextPart(defaultPlaylist, previousPartInstance, (defaultParts as unknown) as Part[])
			expect(nextPart).toEqual({ index: 6, part: defaultParts[6] })
		}

		{
			// nextSegmentId is set
			defaultParts[0].playable = false
			defaultPlaylist.nextSegmentId = segment1
			const nextPart = selectNextPart(defaultPlaylist, previousPartInstance, (defaultParts as unknown) as Part[])
			expect(nextPart).toEqual({ index: 1, part: defaultParts[1], consumesNextSegmentId: true })
		}

		{
			// nextSegmentId is set (and first there isnt playable)
			defaultPlaylist.nextSegmentId = segment2
			const nextPart = selectNextPart(defaultPlaylist, previousPartInstance, (defaultParts as unknown) as Part[])
			expect(nextPart).toEqual({ index: 4, part: defaultParts[4], consumesNextSegmentId: true })
		}
	})

	test('from partInstance - allow unplayable', () => {
		const previousPartInstance = defaultParts[4].toPartInstance()
		{
			// default
			const nextPart = selectNextPart(
				defaultPlaylist,
				previousPartInstance,
				(defaultParts as unknown) as Part[],
				false
			)
			expect(nextPart).toEqual({ index: 5, part: defaultParts[5] })
		}

		{
			// next isnt playable
			defaultParts[5].playable = false
			const nextPart = selectNextPart(
				defaultPlaylist,
				previousPartInstance,
				(defaultParts as unknown) as Part[],
				false
			)
			expect(nextPart).toEqual({ index: 5, part: defaultParts[5] })
		}
	})
})

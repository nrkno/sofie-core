import * as _ from 'underscore'

import { SegmentEntry, diffSegmentEntries } from '../ingest'

describe('Ingest: MOS', () => {

	describe('diffSegmentEntries', () => {
		const sampleData: SegmentEntry[] = [
			{
				'id': 'overblik',
				'name': 'Overblik',
				'parts': [
					'2012R2ENPS8VM;P_ENPSMOS\\W\\F_HOLD ROs\\R_B10067B2-434B-4CF3-AFB1A02EEF8760CB;C355011E-B1E2-425E-AA3D07094F51297F',
					'2012R2ENPS8VM;P_ENPSMOS\\W\\F_HOLD ROs\\R_B10067B2-434B-4CF3-AFB1A02EEF8760CB;484B952B-DE0F-40A0-AC9369C6A140CEBB',
					'2012R2ENPS8VM;P_ENPSMOS\\W\\F_HOLD ROs\\R_B10067B2-434B-4CF3-AFB1A02EEF8760CB;F285B8FA-BD5F-492B-8DAE5BF534A0EAD8',
					'2012R2ENPS8VM;P_ENPSMOS\\W\\F_HOLD ROs\\R_B10067B2-434B-4CF3-AFB1A02EEF8760CB;AE66B8D8-4595-4CA5-B7D35BBDBFD9A4D2',
					'2012R2ENPS8VM;P_ENPSMOS\\W\\F_HOLD ROs\\R_B10067B2-434B-4CF3-AFB1A02EEF8760CB;5C4EE8B8-5459-4A94-8A872A00510269E8'
				]
			},
			{
				'id': 'moller',
				'name': 'Møller og DBU',
				'parts': [
					'2012R2ENPS8VM;P_ENPSMOS\\W\\F_HOLD ROs\\R_B10067B2-434B-4CF3-AFB1A02EEF8760CB;0D1D077D-9720-4560-BB605A012DFAF93E',
					'2012R2ENPS8VM;P_ENPSMOS\\W\\F_HOLD ROs\\R_B10067B2-434B-4CF3-AFB1A02EEF8760CB;D7CCC920-28E9-41AC-B21E0F016576BC73',
					'2012R2ENPS8VM;P_ENPSMOS\\W\\F_HOLD ROs\\R_B10067B2-434B-4CF3-AFB1A02EEF8760CB;D87D86D3-FD0A-42AC-8E100AB374A15DEA',
					'2012R2ENPS8VM;P_ENPSMOS\\W\\F_HOLD ROs\\R_B10067B2-434B-4CF3-AFB1A02EEF8760CB;950A200E-31CA-4DEA-86360F634827C56A'
				]
			},
			{
				'id': 'webhenvisning',
				'name': 'Webhenvisning TV 2 Sporten',
				'parts': [
					'2012R2ENPS8VM;P_ENPSMOS\\W\\F_HOLD ROs\\R_B10067B2-434B-4CF3-AFB1A02EEF8760CB;56CB0445-5782-4F92-A0C24CCA21FE9969'
				]
			},
			{
				'id': 'moller2',
				'name': 'Møller og DBU',
				'parts': [
					'2012R2ENPS8VM;P_ENPSMOS\\W\\F_HOLD ROs\\R_B10067B2-434B-4CF3-AFB1A02EEF8760CB;3487F683-5939-4A37-B41C095014F35C2E',
					'2012R2ENPS8VM;P_ENPSMOS\\W\\F_HOLD ROs\\R_B10067B2-434B-4CF3-AFB1A02EEF8760CB;A0BF2B88-EE9E-40B7-B9D0B70BA3F30F69',
					'2012R2ENPS8VM;P_ENPSMOS\\W\\F_HOLD ROs\\R_B10067B2-434B-4CF3-AFB1A02EEF8760CB;D05B62C7-19F8-4CD7-87B4F8206386BBDD'
				]
			}
		]

		test('No changes', async () => {
			const diff = diffSegmentEntries(sampleData, sampleData)
			expect(diff.changed).toHaveLength(0)
			expect(diff.rankChanged).toHaveLength(0)
			expect(diff.removed).toHaveLength(0)
			expect(diff.unchanged).toEqual([0, 1, 2, 3])
		})

		test('Remove middle of segment', async () => {
			// First segment
			const sampleData2: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			delete sampleData2[0].parts[1]

			const diff = diffSegmentEntries(sampleData, sampleData2)
			expect(diff.changed).toEqual([0])
			expect(diff.rankChanged).toHaveLength(0)
			expect(diff.removed).toHaveLength(0)
			expect(diff.unchanged).toEqual([1, 2, 3])

			// Middle segment
			const sampleData3: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			delete sampleData3[1].parts[1]

			const diff2 = diffSegmentEntries(sampleData, sampleData3)
			expect(diff2.changed).toEqual([1])
			expect(diff2.rankChanged).toHaveLength(0)
			expect(diff2.removed).toHaveLength(0)
			expect(diff2.unchanged).toEqual([0, 2, 3])

			// Last segment
			const sampleData4: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			delete sampleData4[3].parts[1]

			const diff3 = diffSegmentEntries(sampleData, sampleData4)
			expect(diff3.changed).toEqual([3])
			expect(diff3.rankChanged).toHaveLength(0)
			expect(diff3.removed).toHaveLength(0)
			expect(diff3.unchanged).toEqual([0, 1, 2])
		})

		test('Remove start of segment', async () => {
			// First segment
			const sampleData2: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			delete sampleData2[0].parts[0]

			const diff = diffSegmentEntries(sampleData, sampleData2)
			expect(diff.changed).toEqual([0])
			expect(diff.rankChanged).toHaveLength(0)
			expect(diff.removed).toHaveLength(0)
			expect(diff.unchanged).toEqual([1, 2, 3])

			// Middle segment
			const sampleData3: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			delete sampleData3[1].parts[0]

			const diff2 = diffSegmentEntries(sampleData, sampleData3)
			expect(diff2.changed).toEqual([1])
			expect(diff2.rankChanged).toHaveLength(0)
			expect(diff2.removed).toHaveLength(0)
			expect(diff2.unchanged).toEqual([0, 2, 3])

			// Last segment
			const sampleData4: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			delete sampleData4[3].parts[0]

			const diff3 = diffSegmentEntries(sampleData, sampleData4)
			expect(diff3.changed).toEqual([3])
			expect(diff3.rankChanged).toHaveLength(0)
			expect(diff3.removed).toHaveLength(0)
			expect(diff3.unchanged).toEqual([0, 1, 2])
		})

		test('Remove end of segment', async () => {
			// First segment
			const sampleData2: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			delete sampleData2[0].parts[4]

			const diff = diffSegmentEntries(sampleData, sampleData2)
			expect(diff.changed).toEqual([0])
			expect(diff.rankChanged).toHaveLength(0)
			expect(diff.removed).toHaveLength(0)
			expect(diff.unchanged).toEqual([1, 2, 3])

			// Middle segment
			const sampleData3: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			delete sampleData3[1].parts[3]

			const diff2 = diffSegmentEntries(sampleData, sampleData3)
			expect(diff2.changed).toEqual([1])
			expect(diff2.rankChanged).toHaveLength(0)
			expect(diff2.removed).toHaveLength(0)
			expect(diff2.unchanged).toEqual([0, 2, 3])

			// Last segment
			const sampleData4: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			delete sampleData4[3].parts[2]

			const diff3 = diffSegmentEntries(sampleData, sampleData4)
			expect(diff3.changed).toEqual([3])
			expect(diff3.rankChanged).toHaveLength(0)
			expect(diff3.removed).toHaveLength(0)
			expect(diff3.unchanged).toEqual([0, 1, 2])
		})

		test('Remove whole segment', async () => {
			// First segment
			let sampleData2 = JSON.parse(JSON.stringify(sampleData))
			delete sampleData2[0]
			sampleData2 = _.compact(sampleData2)

			const diff = diffSegmentEntries(sampleData, sampleData2)
			expect(diff.changed).toHaveLength(0)
			expect(diff.rankChanged).toEqual([[1,0], [2,1], [3,2]])
			expect(diff.removed).toEqual([0])
			expect(diff.unchanged).toHaveLength(0)

			// Middle segment
			let sampleData3 = JSON.parse(JSON.stringify(sampleData))
			delete sampleData3[1]
			sampleData3 = _.compact(sampleData3)

			const diff2 = diffSegmentEntries(sampleData, sampleData3)
			expect(diff2.changed).toHaveLength(0)
			expect(diff2.rankChanged).toEqual([[2,1], [3,2]])
			expect(diff2.removed).toEqual([1])
			expect(diff2.unchanged).toEqual([0])

			// Last segment
			let sampleData4 = JSON.parse(JSON.stringify(sampleData))
			delete sampleData4[3]
			sampleData4 = _.compact(sampleData4)

			const diff3 = diffSegmentEntries(sampleData, sampleData4)
			expect(diff3.changed).toHaveLength(0)
			expect(diff3.rankChanged).toHaveLength(0)
			expect(diff3.removed).toEqual([3])
			expect(diff3.unchanged).toEqual([0, 1, 2])
		})

		test('Remove to combine segments', async () => {
			let sampleData2 = JSON.parse(JSON.stringify(sampleData))
			delete sampleData2[2]
			sampleData2[1].parts = sampleData2[1].parts.concat(sampleData2[3].parts)
			delete sampleData2[3]
			sampleData2 = _.compact(sampleData2)

			const diff = diffSegmentEntries(sampleData, sampleData2)
			expect(diff.changed).toEqual([1])
			expect(diff.rankChanged).toEqual([])
			expect(diff.removed).toEqual([2, 3])
			expect(diff.unchanged).toEqual([0])
		})

		test('Rename/replace segment', async () => {
			// First segment
			const sampleData2: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			sampleData2[0].name = 'NEW NAME'

			const diff = diffSegmentEntries(sampleData, sampleData2)
			expect(diff.changed).toEqual([0])
			expect(diff.rankChanged).toHaveLength(0)
			expect(diff.removed).toEqual([0])
			expect(diff.unchanged).toEqual([1, 2, 3])

			// Middle segment
			const sampleData3: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			sampleData3[1].name = 'NEW NAME'

			const diff2 = diffSegmentEntries(sampleData, sampleData3)
			expect(diff2.changed).toEqual([1])
			expect(diff2.rankChanged).toHaveLength(0)
			expect(diff2.removed).toEqual([1])
			expect(diff2.unchanged).toEqual([0, 2, 3])

			// Last segment
			const sampleData4: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			sampleData4[3].name = 'NEW NAME'

			const diff3 = diffSegmentEntries(sampleData, sampleData4)
			expect(diff3.changed).toEqual([3])
			expect(diff3.rankChanged).toHaveLength(0)
			expect(diff3.removed).toEqual([3])
			expect(diff3.unchanged).toEqual([0, 1, 2])
		})

		test('Insert into segment', async () => {
			// First segment
			const sampleData2: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			sampleData2[0].parts.splice(2, 0, 'abc')

			const diff = diffSegmentEntries(sampleData, sampleData2)
			expect(diff.changed).toEqual([0])
			expect(diff.rankChanged).toHaveLength(0)
			expect(diff.removed).toHaveLength(0)
			expect(diff.unchanged).toEqual([1, 2, 3])

			// Middle segment
			const sampleData3: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			sampleData3[1].parts.splice(2, 0, 'abc')

			const diff2 = diffSegmentEntries(sampleData, sampleData3)
			expect(diff2.changed).toEqual([1])
			expect(diff2.rankChanged).toHaveLength(0)
			expect(diff2.removed).toHaveLength(0)
			expect(diff2.unchanged).toEqual([0, 2, 3])

			// Last segment
			const sampleData4: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			sampleData4[3].parts.splice(2, 0, 'abc')

			const diff3 = diffSegmentEntries(sampleData, sampleData4)
			expect(diff3.changed).toEqual([3])
			expect(diff3.rankChanged).toHaveLength(0)
			expect(diff3.removed).toHaveLength(0)
			expect(diff3.unchanged).toEqual([0, 1, 2])
		})

		test('Insert new segment', async () => {
			// First segment
			const sampleData2: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			sampleData2.splice(0, 0, {
				id: 'new',
				name: 'NEW NAME',
				parts: [ 'abc' ]
			})

			const diff = diffSegmentEntries(sampleData, sampleData2)
			expect(diff.changed).toEqual([0])
			expect(diff.rankChanged).toEqual([[0,1], [1,2], [2,3], [3,4]])
			expect(diff.removed).toHaveLength(0)
			expect(diff.unchanged).toHaveLength(0)

			// Middle segment
			const sampleData3: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			sampleData3.splice(1, 0, {
				id: 'new',
				name: 'NEW NAME',
				parts: [ 'abc' ]
			})

			const diff2 = diffSegmentEntries(sampleData, sampleData3)
			expect(diff2.changed).toEqual([1])
			expect(diff2.rankChanged).toEqual([[1,2], [2,3], [3,4]])
			expect(diff2.removed).toHaveLength(0)
			expect(diff2.unchanged).toEqual([0])

			// Last segment
			const sampleData4: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			sampleData4.push({
				id: 'new',
				name: 'NEW NAME',
				parts: [ 'abc' ]
			})

			const diff3 = diffSegmentEntries(sampleData, sampleData4)
			expect(diff3.changed).toEqual([4])
			expect(diff3.rankChanged).toHaveLength(0)
			expect(diff3.removed).toHaveLength(0)
			expect(diff3.unchanged).toEqual([0, 1, 2, 3])
		})

		test('Insert new segment, split existing', async () => {
			// // First segment
			const sampleData2: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			sampleData2.splice(1, 0, {
				id: 'new',
				name: 'NEW NAME',
				parts: [ 'abc' ]
			}, {
				id: sampleData2[0].id + '2',
				name: sampleData2[0].name,
				parts: sampleData2[0].parts.splice(4, 5)
			})

			const diff = diffSegmentEntries(sampleData, sampleData2)
			expect(diff.changed).toEqual([0, 1, 2])
			expect(diff.rankChanged).toEqual([[1,3], [2,4], [3,5]])
			expect(diff.removed).toHaveLength(0)
			expect(diff.unchanged).toHaveLength(0)

			// Middle segment
			const sampleData3: SegmentEntry[] = JSON.parse(JSON.stringify(sampleData))
			sampleData3.splice(2, 0, {
				id: 'new',
				name: 'NEW NAME',
				parts: [ 'abc' ]
			}, {
				id: sampleData2[0].id + '2',
				name: sampleData3[1].name,
				parts: sampleData3[1].parts.splice(3, 1)
			})

			const diff2 = diffSegmentEntries(sampleData, sampleData3)
			expect(diff2.changed).toEqual([1, 2, 3])
			expect(diff2.rankChanged).toEqual([[2,4], [3,5]])
			expect(diff2.removed).toHaveLength(0)
			expect(diff2.unchanged).toEqual([0])
		})

	})

})

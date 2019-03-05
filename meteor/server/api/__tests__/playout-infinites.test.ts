import * as chai from 'chai'
import * as _ from 'underscore'
import {} from 'mocha'

import { RunningOrder, DBRunningOrder, RunningOrders } from '../../../lib/collections/RunningOrders'
import { SegmentLine, DBSegmentLine, SegmentLines } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../../lib/collections/SegmentLineItems'

import { updateSourceLayerInfinitesAfterLineInner } from '../playout'
import { TriggerType } from 'superfly-timeline'
import { literal, saveIntoDb } from '../../../lib/lib'
import { Segment, Segments, DBSegment } from '../../../lib/collections/Segments'
import { SegmentLineItemLifespan } from 'tv-automation-sofie-blueprints-integration'
import { MockRO, testRO1 } from './playout-infinites-ro'

const expect = chai.expect
const assert = chai.assert

function setupMockRO (mockRo: MockRO) {
	// TODO - ensure mock RO looks valid?

	saveIntoDb<RunningOrder, DBRunningOrder>(RunningOrders, {
		_id: mockRo.runningOrder._id
	}, [mockRo.runningOrder])

	saveIntoDb<Segment, DBSegment>(Segments, {
		runningOrderId: mockRo.runningOrder._id
	}, mockRo.segments)

	saveIntoDb<SegmentLine, DBSegmentLine>(SegmentLines, {
		runningOrderId: mockRo.runningOrder._id
	}, mockRo.segmentLines)

	saveIntoDb<SegmentLineItem, SegmentLineItem>(SegmentLineItems, {
		runningOrderId: mockRo.runningOrder._id
	}, mockRo.segmentLineItems)

	return RunningOrders.findOne(mockRo.runningOrder._id)
}

describe('playout: updateSourceLayerInfinitesAfterLine', function () {
	it('Full infinite generation', function () {
		const ro = setupMockRO(testRO1)
		expect(ro).to.not.be.undefined

		const origSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)

		expect(updateSourceLayerInfinitesAfterLineInner(ro)).eq('')

		const allSegmentLineItems = SegmentLineItems.find({ runningOrderId: ro._id }).fetch()
		const insertedItems = allSegmentLineItems.filter(sli => origSegmentLineItemIds.indexOf(sli._id) === -1)
		expect(insertedItems).lengthOf(85)

		_.each(insertedItems, item => {
			// Ensure the inserted items look like infinites
			expect(item.infiniteId).to.not.be.undefined
			expect(item.infiniteMode).to.not.be.undefined
			expect(item.infiniteId).to.not.eq(item._id)
			expect(origSegmentLineItemIds).contains(item.infiniteId)
		})

		const grouped = _.groupBy(_.filter(allSegmentLineItems, sli => sli.infiniteId), sli => sli.infiniteId)
		const actualInfinites: {[key: string]: string[]} = {}
		_.each(grouped, (items, key) => {
			actualInfinites[key] = _.map(items, item => item.segmentLineId).sort()
		})

		// console.log(JSON.stringify(actualInfinites, undefined, 3))

		const expectedInfinites = {
			'4QCyxcifIpEHXWQW5mHEnja9vYQ_': [
				'1WWrqgLIvlxNE4ciwOSL2Qn2yCI_',
				'2yKRioTfVGnRztaYBn3uW013U7M_',
				'3_qhlFEIYlESrvZYxbk3ie_5_z0_',
				'BNx_pjsUS_NZmV8z_YmAT_C0riU_',
				'BX_SmzfT60bQ2_6VGHxKuzjKZdg_',
				'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
				'GuR5i3ccRRKVhdOtOmgzP8Coeqs_',
				'IomGMc7Zfwxem69eqqvlMjRSj9E_',
				'MTwVEbe90uguNcecrum5tqVLzWg_',
				'Q5fb7VHFWQZjgdUQ_AD9QZjrknk_',
				'R0HMkiSy38MascKSmom2ovahStc_',
				'UoSeVe3h1b67aSun_UMUSSz9NZw_',
				'W3bcE_DKgzZwoq17RsaKBn3__yc_',
				'bzwmGuXuSSg_dRHhlNDFNNl1_Js_',
				'cq9VY7XbnFhpZGSr0q5tfvOx5gs_',
				'gRQFPOgXaV7r_WqgNCPqVcAvsGc_',
				'gtWWWXdaRUM3KfiXAWoRUN879a8_',
				'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
				'jh3nz3Le_21YJMCMTZ_uwp6smDY_',
				'kPKjHD_z3qXD35LqPOD314lOSPo_',
				'kjW9GfMhvvh_CdSnBrnQmd9WBOk_',
				'nArzKAkxPONWUVchEVB4o1Q4VsE_',
				'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
				'qGi_A8A0NtZoSgNnYZVNI_Vb700_',
				'rUiB1GP4V671z_rYY03v1eM_icQ_',
				'saTW13T4_wBQQIXXw9J1dRU0XXw_',
				'zZPFW5kV_Cy1w_NeZX7nvAGxFSQ_'
			],
			'WuaX_RP_keOMe2L7q1oVgQH7AOg_': [
				'1WWrqgLIvlxNE4ciwOSL2Qn2yCI_',
				'2yKRioTfVGnRztaYBn3uW013U7M_',
				'3_qhlFEIYlESrvZYxbk3ie_5_z0_',
				'BNx_pjsUS_NZmV8z_YmAT_C0riU_',
				'BX_SmzfT60bQ2_6VGHxKuzjKZdg_',
				'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
				'IomGMc7Zfwxem69eqqvlMjRSj9E_',
				'MTwVEbe90uguNcecrum5tqVLzWg_',
				'Q5fb7VHFWQZjgdUQ_AD9QZjrknk_',
				'R0HMkiSy38MascKSmom2ovahStc_',
				'UoSeVe3h1b67aSun_UMUSSz9NZw_',
				'W3bcE_DKgzZwoq17RsaKBn3__yc_',
				'cq9VY7XbnFhpZGSr0q5tfvOx5gs_',
				'gRQFPOgXaV7r_WqgNCPqVcAvsGc_',
				'gtWWWXdaRUM3KfiXAWoRUN879a8_',
				'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
				'jh3nz3Le_21YJMCMTZ_uwp6smDY_',
				'kPKjHD_z3qXD35LqPOD314lOSPo_',
				'kjW9GfMhvvh_CdSnBrnQmd9WBOk_',
				'nArzKAkxPONWUVchEVB4o1Q4VsE_',
				'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
				'rUiB1GP4V671z_rYY03v1eM_icQ_',
				'saTW13T4_wBQQIXXw9J1dRU0XXw_',
				'zZPFW5kV_Cy1w_NeZX7nvAGxFSQ_'
			],
			'1Vf17ep1XE2bcAAUrokLfiAbohg_': [
				'1WWrqgLIvlxNE4ciwOSL2Qn2yCI_',
				'2yKRioTfVGnRztaYBn3uW013U7M_',
				'3_qhlFEIYlESrvZYxbk3ie_5_z0_',
				'BNx_pjsUS_NZmV8z_YmAT_C0riU_',
				'BX_SmzfT60bQ2_6VGHxKuzjKZdg_',
				'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
				'IomGMc7Zfwxem69eqqvlMjRSj9E_',
				'MTwVEbe90uguNcecrum5tqVLzWg_',
				'Q5fb7VHFWQZjgdUQ_AD9QZjrknk_',
				'R0HMkiSy38MascKSmom2ovahStc_',
				'UoSeVe3h1b67aSun_UMUSSz9NZw_',
				'W3bcE_DKgzZwoq17RsaKBn3__yc_',
				'cq9VY7XbnFhpZGSr0q5tfvOx5gs_',
				'gRQFPOgXaV7r_WqgNCPqVcAvsGc_',
				'gtWWWXdaRUM3KfiXAWoRUN879a8_',
				'hDsI_wI5jDH53Z4X2hwu9V_1V1Y_',
				'jh3nz3Le_21YJMCMTZ_uwp6smDY_',
				'kPKjHD_z3qXD35LqPOD314lOSPo_',
				'kjW9GfMhvvh_CdSnBrnQmd9WBOk_',
				'nArzKAkxPONWUVchEVB4o1Q4VsE_',
				'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
				'rUiB1GP4V671z_rYY03v1eM_icQ_',
				'saTW13T4_wBQQIXXw9J1dRU0XXw_',
				'zZPFW5kV_Cy1w_NeZX7nvAGxFSQ_'
			],
			'M7Yw6rNvbRW8mgwbVWCo0CFpdBI_': [
				'3_qhlFEIYlESrvZYxbk3ie_5_z0_',
				'rUiB1GP4V671z_rYY03v1eM_icQ_'
			],
			'_JL11OWpq_lrCvi2Q4g7iUL5Vfc_': [
				'3_qhlFEIYlESrvZYxbk3ie_5_z0_',
				'Q5fb7VHFWQZjgdUQ_AD9QZjrknk_',
				'W3bcE_DKgzZwoq17RsaKBn3__yc_',
				'rUiB1GP4V671z_rYY03v1eM_icQ_'
			],
			'9MAvR7_U8rnEorrfh10ttwgSsYs_': [
				'BX_SmzfT60bQ2_6VGHxKuzjKZdg_',
				'kPKjHD_z3qXD35LqPOD314lOSPo_'
			],
			'CKOR8_Z8g1_ijNvVpONMv2szFc8_': [
				'BX_SmzfT60bQ2_6VGHxKuzjKZdg_',
				'kPKjHD_z3qXD35LqPOD314lOSPo_'
			],
			'lEWIkpUtGIg_75H1xL06rFwxd4g_': [
				'BX_SmzfT60bQ2_6VGHxKuzjKZdg_',
				'W3bcE_DKgzZwoq17RsaKBn3__yc_'
			],
			'ml0O0D0CjZN2M3rvuc6qjHw0V5s_': [
				'ESeI8e10J9XgRKIVYfs9BHu_mMg_',
				'gtWWWXdaRUM3KfiXAWoRUN879a8_'
			],
			'9wPCrktBThPitm0JiE7FIOuoRJo_': [
				'GuR5i3ccRRKVhdOtOmgzP8Coeqs_',
				'bzwmGuXuSSg_dRHhlNDFNNl1_Js_',
				'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_',
				'qGi_A8A0NtZoSgNnYZVNI_Vb700_'
			],
			'aswCTk5xUuaMHFIzQjpVzVmywJc_': [
				'R0HMkiSy38MascKSmom2ovahStc_'
			],
			'YW57oEWHtHhYH_Iy0FdM8H1Piy4_': [
				'UoSeVe3h1b67aSun_UMUSSz9NZw_',
				'nArzKAkxPONWUVchEVB4o1Q4VsE_'
			],
			'qcIUFY0abKSsUhYZ55KkDZU1OBU_': [
				'bzwmGuXuSSg_dRHhlNDFNNl1_Js_',
				'qGi_A8A0NtZoSgNnYZVNI_Vb700_'
			],
			'zXU6HCl7N3v9v8ur9F8RqFO_1M8_': [
				'qGi_A8A0NtZoSgNnYZVNI_Vb700_'
			]
		}

		// Not the pretties, but ensures that the infinites for each sli are as expected
		expect(actualInfinites).eql(expectedInfinites)
	})

	it('Ensure cleans up non-infinites', function () {
		const ro = setupMockRO(testRO1)
		expect(ro).to.not.be.undefined

		const origSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)

		expect(updateSourceLayerInfinitesAfterLineInner(ro)).eq('')

		// Make everything be non-infinite
		SegmentLineItems.update({ runningOrderId: ro._id }, {
			$unset: {
				infiniteMode: 1
			}
		}, { multi: true})

		expect(updateSourceLayerInfinitesAfterLineInner(ro)).eq('')

		const afterSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)
		expect(afterSegmentLineItemIds).to.eql(origSegmentLineItemIds)
	})

	it('Ensure no mode creates nothing', function () {
		const ro = setupMockRO(testRO1)
		expect(ro).to.not.be.undefined

		const origSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)

		// Make everything be non-infinite
		SegmentLineItems.update({ runningOrderId: ro._id }, {
			$unset: {
				infiniteMode: 1
			}
		}, { multi: true})

		expect(updateSourceLayerInfinitesAfterLineInner(ro)).eq('')

		const afterSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)
		expect(afterSegmentLineItemIds).to.eql(origSegmentLineItemIds)
	})

	it('Ensure SegmentLineItemLifespan.OutOnNextSegmentLine creates nothing', function () {
		const ro = setupMockRO(testRO1)
		expect(ro).to.not.be.undefined

		const origSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)

		// Make everything be non-infinite
		SegmentLineItems.update({ runningOrderId: ro._id }, {
			$set: {
				infiniteMode: SegmentLineItemLifespan.OutOnNextSegmentLine
			}
		}, { multi: true})

		expect(updateSourceLayerInfinitesAfterLineInner(ro)).eq('')

		const afterSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)
		expect(afterSegmentLineItemIds).to.eql(origSegmentLineItemIds)
	})

	it('Ensure rerun makes no change', function () {
		const ro = setupMockRO(testRO1)
		expect(ro).to.not.be.undefined

		expect(updateSourceLayerInfinitesAfterLineInner(ro)).eq('')

		const origSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)

		expect(updateSourceLayerInfinitesAfterLineInner(ro)).eq('')

		// Expect the ids to all be the same
		const afterSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)
		expect(afterSegmentLineItemIds).to.eql(origSegmentLineItemIds)
	})

	it('Ensure line mode change propogates', function () {
		const ro = setupMockRO(testRO1)
		expect(ro).to.not.be.undefined
		expect(updateSourceLayerInfinitesAfterLineInner(ro)).eq('')

		const sliId = '9wPCrktBThPitm0JiE7FIOuoRJo_'

		function getInfiniteModes (infiniteId: string) {
			return SegmentLineItems.find({
				infiniteId: sliId
			}, {
				sort: {
					segmentLineId: 1
				}
			}).map(sli => sli.infiniteMode)
		}

		const origModes = getInfiniteModes(sliId)
		expect(origModes).eql([2, 2, 0, 2])

		// Update a single sli
		SegmentLineItems.update(sliId, {
			$set: {
				infiniteMode: SegmentLineItemLifespan.Infinite
			}
		})

		// regenerate infinites
		expect(updateSourceLayerInfinitesAfterLineInner(ro)).eq('')

		const afterModes = getInfiniteModes(sliId)
		expect(afterModes).eql([3, 3, 0, 3])
	})

	it('Ensure line name change propogates', function () {
		const ro = setupMockRO(testRO1)
		expect(ro).to.not.be.undefined
		expect(updateSourceLayerInfinitesAfterLineInner(ro)).eq('')

		const sliId = '9wPCrktBThPitm0JiE7FIOuoRJo_'

		function checkInfiniteNames (infiniteId: string, expectedName: string) {
			const names = SegmentLineItems.find({
				infiniteId: sliId
			}, {
				sort: {
					segmentLineId: 1
				}
			}).map(sli => sli.name)

			_.each(names, n => {
				expect(n).eq(expectedName)
			})
		}

		checkInfiniteNames(sliId, 'Vignett bed')

		// Update a single sli
		SegmentLineItems.update(sliId, {
			$set: {
				name: 'new name'
			}
		})

		// regenerate infinites
		expect(updateSourceLayerInfinitesAfterLineInner(ro)).eq('')

		checkInfiniteNames(sliId, 'new name')
	})

	it('Ensure setting prevLine makes no change', function () {
		const ro = setupMockRO(testRO1)
		expect(ro).to.not.be.undefined

		const sliId = 'M7Yw6rNvbRW8mgwbVWCo0CFpdBI_'
		const prevSlId = 'BNx_pjsUS_NZmV8z_YmAT_C0riU_'

		expect(updateSourceLayerInfinitesAfterLineInner(ro)).eq('')

		const origSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)

		const prevSegmentLine = SegmentLines.findOne(prevSlId)
		expect(prevSegmentLine).not.undefined

		expect(updateSourceLayerInfinitesAfterLineInner(ro, prevSegmentLine)).eq('') // TODO - this should stop before the end!

		// Expect the ids to all be the same
		const afterSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)
		expect(afterSegmentLineItemIds).to.eql(origSegmentLineItemIds)
	})

	it('Ensure prevLine updates current line', function () {
		const ro = setupMockRO(testRO1)
		expect(ro).to.not.be.undefined

		const sliId = 'M7Yw6rNvbRW8mgwbVWCo0CFpdBI_'
		const prevSlId = 'BNx_pjsUS_NZmV8z_YmAT_C0riU_'

		expect(updateSourceLayerInfinitesAfterLineInner(ro)).eq('')

		const origSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)

		function getInfiniteModes (infiniteId: string) {
			return SegmentLineItems.find({
				infiniteId: sliId
			}, {
				sort: {
					segmentLineId: 1
				}
			}).map(sli => sli.infiniteMode)
		}

		const origModes = getInfiniteModes(sliId)
		expect(origModes).eql([2, 2])

		// Update a single sli
		SegmentLineItems.update(sliId, {
			$set: {
				infiniteMode: SegmentLineItemLifespan.Infinite
			}
		})

		const prevSegmentLine = SegmentLines.findOne(prevSlId)
		expect(prevSegmentLine).not.undefined

		// regenerate infinites
		expect(updateSourceLayerInfinitesAfterLineInner(ro, prevSegmentLine)).eq('')

		// It is expected that there are 2 more sli now
		const afterModes = getInfiniteModes(sliId)
		expect(afterModes).eql([3, 3, 0, 3])

		origSegmentLineItemIds.push('M7Yw6rNvbRW8mgwbVWCo0CFpdBI__Q5fb7VHFWQZjgdUQ_AD9QZjrknk_', 'M7Yw6rNvbRW8mgwbVWCo0CFpdBI__W3bcE_DKgzZwoq17RsaKBn3__yc_')

		// Expect the ids to all be the same
		const afterSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)
		expect(afterSegmentLineItemIds.sort()).to.eql(origSegmentLineItemIds.sort())
	})

	it('Ensure update when adding infinite in the middle of another', function () {
		const ro = setupMockRO(testRO1)
		expect(ro).to.not.be.undefined

		const currentSlId = 'rUiB1GP4V671z_rYY03v1eM_icQ_'
		const prevSlId = 'BNx_pjsUS_NZmV8z_YmAT_C0riU_'

		// First generate
		expect(updateSourceLayerInfinitesAfterLineInner(ro)).eq('')
		const origSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)

		const newSli = literal<SegmentLineItem>({
			_id: 'test_klokke_break',
			runningOrderId : ro._id,
			segmentLineId : currentSlId,
			status : -1,
			mosId : '',
			name : 'split klokke',
			trigger : {
				type : 0,
				value : 0
			},
			sourceLayerId : 'studio0_graphics_klokke',
			outputLayerId : 'pgm0',
			expectedDuration : 0,
			content : {
				timelineObjects : []
			},
			infiniteMode: SegmentLineItemLifespan.OutOnNextSegment
		})
		SegmentLineItems.insert(newSli)

		const expectedSegmentLineItemIds = ['test_klokke_break', 'test_klokke_break_3_qhlFEIYlESrvZYxbk3ie_5_z0_'].concat(origSegmentLineItemIds)

		const prevSegmentLine = SegmentLines.findOne(prevSlId)
		expect(prevSegmentLine).not.undefined

		// regenerate infinites
		expect(updateSourceLayerInfinitesAfterLineInner(ro, prevSegmentLine)).eq('')

		const afterSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)

		const expectedMissing: string[] = [
			'1Vf17ep1XE2bcAAUrokLfiAbohg__1WWrqgLIvlxNE4ciwOSL2Qn2yCI_',
			'1Vf17ep1XE2bcAAUrokLfiAbohg__3_qhlFEIYlESrvZYxbk3ie_5_z0_',
			'1Vf17ep1XE2bcAAUrokLfiAbohg__BX_SmzfT60bQ2_6VGHxKuzjKZdg_',
			'1Vf17ep1XE2bcAAUrokLfiAbohg__ESeI8e10J9XgRKIVYfs9BHu_mMg_',
			'1Vf17ep1XE2bcAAUrokLfiAbohg__MTwVEbe90uguNcecrum5tqVLzWg_',
			'1Vf17ep1XE2bcAAUrokLfiAbohg__Q5fb7VHFWQZjgdUQ_AD9QZjrknk_',
			'1Vf17ep1XE2bcAAUrokLfiAbohg__UoSeVe3h1b67aSun_UMUSSz9NZw_',
			'1Vf17ep1XE2bcAAUrokLfiAbohg__W3bcE_DKgzZwoq17RsaKBn3__yc_',
			'1Vf17ep1XE2bcAAUrokLfiAbohg__cq9VY7XbnFhpZGSr0q5tfvOx5gs_',
			'1Vf17ep1XE2bcAAUrokLfiAbohg__gRQFPOgXaV7r_WqgNCPqVcAvsGc_',
			'1Vf17ep1XE2bcAAUrokLfiAbohg__gtWWWXdaRUM3KfiXAWoRUN879a8_',
			'1Vf17ep1XE2bcAAUrokLfiAbohg__jh3nz3Le_21YJMCMTZ_uwp6smDY_',
			'1Vf17ep1XE2bcAAUrokLfiAbohg__kPKjHD_z3qXD35LqPOD314lOSPo_',
			'1Vf17ep1XE2bcAAUrokLfiAbohg__nArzKAkxPONWUVchEVB4o1Q4VsE_',
			'1Vf17ep1XE2bcAAUrokLfiAbohg__rUiB1GP4V671z_rYY03v1eM_icQ_',
			'1Vf17ep1XE2bcAAUrokLfiAbohg__zZPFW5kV_Cy1w_NeZX7nvAGxFSQ_'
		]
		_.each(expectedMissing, missing => {
			expect(afterSegmentLineItemIds).not.contains(missing)
		})

		const afterWithRemoved = expectedMissing.concat(afterSegmentLineItemIds)
		expect(afterWithRemoved.sort()).eql(expectedSegmentLineItemIds.sort())
	})

	it('Ensure update when moving ro removing sli which breaks an infinite', function () {
		const ro = setupMockRO(testRO1)
		expect(ro).to.not.be.undefined

		const sliId = 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ__bed_fade'
		const currentSlId = 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_'
		const prevSlId = 'qGi_A8A0NtZoSgNnYZVNI_Vb700_'

		// First generate
		expect(updateSourceLayerInfinitesAfterLineInner(ro)).eq('')
		const origSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)

		const prevSegmentLine = SegmentLines.findOne(prevSlId)
		expect(prevSegmentLine).not.undefined

		// Move the 'blocker' to abs0, means that the infinite logic will not include an extension in the sl before the blocker
		SegmentLineItems.update(sliId, {
			$set: {
				trigger: {
					type: TriggerType.TIME_ABSOLUTE,
					value: 0
				}
			}
		})

		// regenerate infinites
		expect(updateSourceLayerInfinitesAfterLineInner(ro, prevSegmentLine)).eq('')

		const midSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)

		// The last segment should be removed
		expect(midSegmentLineItemIds).not.contains('9wPCrktBThPitm0JiE7FIOuoRJo__nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_')
		const midWithRemoved = ['9wPCrktBThPitm0JiE7FIOuoRJo__nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_'].concat(midSegmentLineItemIds)
		expect(midWithRemoved.sort()).eql(origSegmentLineItemIds.sort())

		// Now remove the blocker and it should basically just come back
		SegmentLineItems.remove(sliId)
		expect(updateSourceLayerInfinitesAfterLineInner(ro, prevSegmentLine)).eq('')

		const afterSegmentLineItemIds: string[] = SegmentLineItems.find({ runningOrderId: ro._id }).map(sli => sli._id)
		expect(afterSegmentLineItemIds).contains('9wPCrktBThPitm0JiE7FIOuoRJo__nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_')

		// Should have same ids as the start
		expect(origSegmentLineItemIds.sort()).eql(origSegmentLineItemIds.sort())
	})

	it('Ensure durationOverride value persists', function () {
		const ro = setupMockRO(testRO1)
		expect(ro).to.not.be.undefined
		expect(updateSourceLayerInfinitesAfterLineInner(ro)).eq('')

		const infId = '9wPCrktBThPitm0JiE7FIOuoRJo_'
		const slId = 'bzwmGuXuSSg_dRHhlNDFNNl1_Js_'

		// Update a single sli
		expect(SegmentLineItems.update({
			segmentLineId: slId,
			infiniteId: infId
		}, {
			$set: {
				durationOverride: 1000
			}
		})).eq(1)

		// regenerate infinites
		expect(updateSourceLayerInfinitesAfterLineInner(ro)).eq('')

		const infiniteParts = SegmentLineItems.find({ infiniteId: infId }).fetch()
		expect(infiniteParts).lengthOf(2)

		const partWithDuration = SegmentLineItems.findOne({ infiniteId: infId, segmentLineId: slId })
		expect(partWithDuration).not.undefined
		expect(partWithDuration.durationOverride).not.undefined

	})
})

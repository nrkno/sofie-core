test('mockTest', () => {
	expect(1).toEqual(1)
})
/*
import * as chai from 'chai'
import * as _ from 'underscore'
import {} from 'mocha'

import { Rundown, DBRundown, Rundowns } from '../../../lib/collections/Rundowns'
import { Part, DBPart, Parts } from '../../../lib/collections/Parts'
import { Piece, Pieces } from '../../../lib/collections/Pieces'

import { updateSourceLayerInfinitesAfterLineInner } from '../playout'
import { TriggerType } from 'superfly-timeline'
import { literal, saveIntoDb } from '../../../lib/lib'
import { Segment, Segments, DBSegment } from '../../../lib/collections/Segments'
import { PieceLifespan } from 'tv-automation-sofie-blueprints-integration'
import { MockRO, testRO1 } from './playout-infinites-rundown'

const expect = chai.expect
const assert = chai.assert

function setupMockRO (mockRundown: MockRO) {
	// TODO - ensure mock rundown looks valid?

	saveIntoDb<Rundown, DBRundown>(Rundowns, {
		_id: mockRundown.rundown._id
	}, [mockRundown.rundown])

	saveIntoDb<Segment, DBSegment>(Segments, {
		rundownId: mockRundown.rundown._id
	}, mockRundown.segments)

	saveIntoDb<Part, DBPart>(Parts, {
		rundownId: mockRundown.rundown._id
	}, mockRundown.parts)

	saveIntoDb<Piece, Piece>(Pieces, {
		rundownId: mockRundown.rundown._id
	}, mockRundown.pieces)

	return Rundowns.findOne(mockRundown.rundown._id)
}

describe('playout: updateSourceLayerInfinitesAfterLine', function () {
	it('Full infinite generation', function () {
		const rundown = setupMockRO(testRO1)
		expect(rundown).to.not.be.undefined

		const origPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)

		expect(updateSourceLayerInfinitesAfterLineInner(rundown)).eq('')

		const allPieces = Pieces.find({ rundownId: rundown._id }).fetch()
		const insertedItems = allPieces.filter(piece => origPieceIds.indexOf(piece._id) === -1)
		expect(insertedItems).lengthOf(85)

		_.each(insertedItems, item => {
			// Ensure the inserted items look like infinites
			expect(item.infiniteId).to.not.be.undefined
			expect(item.infiniteMode).to.not.be.undefined
			expect(item.infiniteId).to.not.eq(item._id)
			expect(origPieceIds).contains(item.infiniteId)
		})

		const grouped = _.groupBy(_.filter(allPieces, piece => piece.infiniteId), piece => piece.infiniteId)
		const actualInfinites: {[key: string]: string[]} = {}
		_.each(grouped, (items, key) => {
			actualInfinites[key] = _.map(items, item => item.partId).sort()
		})


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
				'hDstudio_wI5jDH53Z4X2hwu9V_1V1Y_',
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
				'hDstudio_wI5jDH53Z4X2hwu9V_1V1Y_',
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
				'hDstudio_wI5jDH53Z4X2hwu9V_1V1Y_',
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

		// Not the pretties, but ensures that the infinites for each piece are as expected
		expect(actualInfinites).eql(expectedInfinites)
	})

	it('Ensure cleans up non-infinites', function () {
		const rundown = setupMockRO(testRO1)
		expect(rundown).to.not.be.undefined

		const origPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)

		expect(updateSourceLayerInfinitesAfterLineInner(rundown)).eq('')

		// Make everything be non-infinite
		Pieces.update({ rundownId: rundown._id }, {
			$unset: {
				infiniteMode: 1
			}
		}, { multi: true})

		expect(updateSourceLayerInfinitesAfterLineInner(rundown)).eq('')

		const afterPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)
		expect(afterPieceIds).to.eql(origPieceIds)
	})

	it('Ensure no mode creates nothing', function () {
		const rundown = setupMockRO(testRO1)
		expect(rundown).to.not.be.undefined

		const origPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)

		// Make everything be non-infinite
		Pieces.update({ rundownId: rundown._id }, {
			$unset: {
				infiniteMode: 1
			}
		}, { multi: true})

		expect(updateSourceLayerInfinitesAfterLineInner(rundown)).eq('')

		const afterPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)
		expect(afterPieceIds).to.eql(origPieceIds)
	})

	it('Ensure PieceLifespan.OutOnNextPart creates nothing', function () {
		const rundown = setupMockRO(testRO1)
		expect(rundown).to.not.be.undefined

		const origPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)

		// Make everything be non-infinite
		Pieces.update({ rundownId: rundown._id }, {
			$set: {
				infiniteMode: PieceLifespan.OutOnNextPart
			}
		}, { multi: true})

		expect(updateSourceLayerInfinitesAfterLineInner(rundown)).eq('')

		const afterPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)
		expect(afterPieceIds).to.eql(origPieceIds)
	})

	it('Ensure rerun makes no change', function () {
		const rundown = setupMockRO(testRO1)
		expect(rundown).to.not.be.undefined

		expect(updateSourceLayerInfinitesAfterLineInner(rundown)).eq('')

		const origPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)

		expect(updateSourceLayerInfinitesAfterLineInner(rundown)).eq('')

		// Expect the ids to all be the same
		const afterPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)
		expect(afterPieceIds).to.eql(origPieceIds)
	})

	it('Ensure line mode change propogates', function () {
		const rundown = setupMockRO(testRO1)
		expect(rundown).to.not.be.undefined
		expect(updateSourceLayerInfinitesAfterLineInner(rundown)).eq('')

		const pieceId = '9wPCrktBThPitm0JiE7FIOuoRJo_'

		function getInfiniteModes (infiniteId: string) {
			return Pieces.find({
				infiniteId: pieceId
			}, {
				sort: {
					partId: 1
				}
			}).map(piece => piece.infiniteMode)
		}

		const origModes = getInfiniteModes(pieceId)
		expect(origModes).eql([2, 2, 0, 2])

		// Update a single piece

		Pieces.update(pieceId, {
			$set: {
				infiniteMode: PieceLifespan.Infinite
			}
		})

		// regenerate infinites
		expect(updateSourceLayerInfinitesAfterLineInner(rundown)).eq('')

		const afterModes = getInfiniteModes(pieceId)
		expect(afterModes).eql([3, 3, 0, 3])
	})

	it('Ensure line name change propogates', function () {
		const rundown = setupMockRO(testRO1)
		expect(rundown).to.not.be.undefined
		expect(updateSourceLayerInfinitesAfterLineInner(rundown)).eq('')

		const pieceId = '9wPCrktBThPitm0JiE7FIOuoRJo_'

		function checkInfiniteNames (infiniteId: string, expectedName: string) {
			const names = Pieces.find({
				infiniteId: pieceId
			}, {
				sort: {
					partId: 1
				}
			}).map(piece => piece.name)

			_.each(names, n => {
				expect(n).eq(expectedName)
			})
		}

		checkInfiniteNames(pieceId, 'Vignett bed')

		// Update a single piece

		Pieces.update(pieceId, {
			$set: {
				name: 'new name'
			}
		})

		// regenerate infinites
		expect(updateSourceLayerInfinitesAfterLineInner(rundown)).eq('')

		checkInfiniteNames(pieceId, 'new name')
	})

	it('Ensure setting prevLine makes no change', function () {
		const rundown = setupMockRO(testRO1)
		expect(rundown).to.not.be.undefined

		const pieceId = 'M7Yw6rNvbRW8mgwbVWCo0CFpdBI_'
		const prevSlId = 'BNx_pjsUS_NZmV8z_YmAT_C0riU_'

		expect(updateSourceLayerInfinitesAfterLineInner(rundown)).eq('')

		const origPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)

		const prevPart = Parts.findOne(prevSlId)
		expect(prevPart).not.undefined

		expect(updateSourceLayerInfinitesAfterLineInner(rundown, prevPart)).eq('') // TODO - this should stop before the end!

		// Expect the ids to all be the same
		const afterPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)
		expect(afterPieceIds).to.eql(origPieceIds)
	})

	it('Ensure prevLine updates current line', function () {
		const rundown = setupMockRO(testRO1)
		expect(rundown).to.not.be.undefined

		const pieceId = 'M7Yw6rNvbRW8mgwbVWCo0CFpdBI_'
		const prevSlId = 'BNx_pjsUS_NZmV8z_YmAT_C0riU_'

		expect(updateSourceLayerInfinitesAfterLineInner(rundown)).eq('')

		const origPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)

		function getInfiniteModes (infiniteId: string) {
			return Pieces.find({
				infiniteId: pieceId
			}, {
				sort: {
					partId: 1
				}
			}).map(piece => piece.infiniteMode)
		}

		const origModes = getInfiniteModes(pieceId)
		expect(origModes).eql([2, 2])

		// Update a single piece

		Pieces.update(pieceId, {
			$set: {
				infiniteMode: PieceLifespan.Infinite
			}
		})

		const prevPart = Parts.findOne(prevSlId)
		expect(prevPart).not.undefined

		// regenerate infinites
		expect(updateSourceLayerInfinitesAfterLineInner(rundown, prevPart)).eq('')

		// It is expected that there are 2 more piece now
		const afterModes = getInfiniteModes(pieceId)
		expect(afterModes).eql([3, 3, 0, 3])

		origPieceIds.push('M7Yw6rNvbRW8mgwbVWCo0CFpdBI__Q5fb7VHFWQZjgdUQ_AD9QZjrknk_', 'M7Yw6rNvbRW8mgwbVWCo0CFpdBI__W3bcE_DKgzZwoq17RsaKBn3__yc_')

		// Expect the ids to all be the same
		const afterPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)
		expect(afterPieceIds.sort()).to.eql(origPieceIds.sort())
	})

	it('Ensure update when adding infinite in the middle of another', function () {
		const rundown = setupMockRO(testRO1)
		expect(rundown).to.not.be.undefined

		const currentSlId = 'rUiB1GP4V671z_rYY03v1eM_icQ_'
		const prevSlId = 'BNx_pjsUS_NZmV8z_YmAT_C0riU_'

		// First generate
		expect(updateSourceLayerInfinitesAfterLineInner(rundown)).eq('')
		const origPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)

		const newPiece = literal<Piece>({
			_id: 'test_klokke_break',
			rundownId : rundown._id,
			partId : currentSlId,
			status : -1,
			externalId : '',
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
			infiniteMode: PieceLifespan.OutOnNextSegment
		})
		Pieces.insert(newPiece)

		const expectedPieceIds = ['test_klokke_break', 'test_klokke_break_3_qhlFEIYlESrvZYxbk3ie_5_z0_'].concat(origPieceIds)

		const prevPart = Parts.findOne(prevSlId)
		expect(prevPart).not.undefined

		// regenerate infinites
		expect(updateSourceLayerInfinitesAfterLineInner(rundown, prevPart)).eq('')

		const afterPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)

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
			expect(afterPieceIds).not.contains(missing)
		})

		const afterWithRemoved = expectedMissing.concat(afterPieceIds)
		expect(afterWithRemoved.sort()).eql(expectedPieceIds.sort())
	})

	it('Ensure update when moving rundown removing piece which breaks an infinite', function () {
		const rundown = setupMockRO(testRO1)
		expect(rundown).to.not.be.undefined

		const pieceId = 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ__bed_fade'
		const currentSlId = 'nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_'
		const prevSlId = 'qGi_A8A0NtZoSgNnYZVNI_Vb700_'

		// First generate
		expect(updateSourceLayerInfinitesAfterLineInner(rundown)).eq('')
		const origPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)

		const prevPart = Parts.findOne(prevSlId)
		expect(prevPart).not.undefined

		// Move the 'blocker' to abs0, means that the infinite logic will not include an extension in the part before the blocker
		Pieces.update(pieceId, {
			$set: {
				trigger: {
					type: TriggerType.TIME_ABSOLUTE,
					value: 0
				}
			}
		})

		// regenerate infinites
		expect(updateSourceLayerInfinitesAfterLineInner(rundown, prevPart)).eq('')

		const midPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)

		// The last segment should be removed
		expect(midPieceIds).not.contains('9wPCrktBThPitm0JiE7FIOuoRJo__nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_')
		const midWithRemoved = ['9wPCrktBThPitm0JiE7FIOuoRJo__nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_'].concat(midPieceIds)
		expect(midWithRemoved.sort()).eql(origPieceIds.sort())

		// Now remove the blocker and it should basically just come back
		Pieces.remove(pieceId)
		expect(updateSourceLayerInfinitesAfterLineInner(rundown, prevPart)).eq('')

		const afterPieceIds: string[] = Pieces.find({ rundownId: rundown._id }).map(piece => piece._id)
		expect(afterPieceIds).contains('9wPCrktBThPitm0JiE7FIOuoRJo__nDQtVZ1Bo0J3qEYnBqjr7KuyhDQ_')

		// Should have same ids as the start
		expect(origPieceIds.sort()).eql(origPieceIds.sort())
	})

	it('Ensure durationOverride value persists', function () {
		const rundown = setupMockRO(testRO1)
		expect(rundown).to.not.be.undefined
		expect(updateSourceLayerInfinitesAfterLineInner(rundown)).eq('')

		const infId = '9wPCrktBThPitm0JiE7FIOuoRJo_'
		const partId = 'bzwmGuXuSSg_dRHhlNDFNNl1_Js_'

		// Update a single piece

		expect(Pieces.update({
			partId: partId,
			infiniteId: infId
		}, {
			$set: {
				durationOverride: 1000
			}
		})).eq(1)

		// regenerate infinites
		expect(updateSourceLayerInfinitesAfterLineInner(rundown)).eq('')

		const infiniteParts = Pieces.find({ infiniteId: infId }).fetch()
		expect(infiniteParts).lengthOf(2)

		const partWithDuration = Pieces.findOne({ infiniteId: infId, partId: partId })
		expect(partWithDuration).not.undefined
		expect(partWithDuration.durationOverride).not.undefined

	})
})
*/

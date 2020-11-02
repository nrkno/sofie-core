import { Rundowns, DBRundown, RundownId } from '../../../lib/collections/Rundowns'
import { literal, protectString, getRandomId, waitForPromise } from '../../../lib/lib'
import { setupDefaultStudioEnvironment, LAYER_IDS } from '../../../__mocks__/helpers/database'
import { DBPart, Parts, PartId } from '../../../lib/collections/Parts'
import { VTContent, PieceLifespan } from 'tv-automation-sofie-blueprints-integration'
import { Segments, DBSegment } from '../../../lib/collections/Segments'
import { Pieces, Piece, PieceId } from '../../../lib/collections/Pieces'
import { RundownAPI } from '../../../lib/api/rundown'
import { updateExpectedMediaItemsOnRundown, updateExpectedMediaItemsOnPart } from '../expectedMediaItems'
import { ExpectedMediaItems } from '../../../lib/collections/ExpectedMediaItems'
import { testInFiber, beforeAllInFiber } from '../../../__mocks__/helpers/jest'
import { AdLibPieces, AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { RundownPlaylists, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { initCacheForRundownPlaylistFromRundown } from '../../DatabaseCaches'
import { removeRundownFromCache } from '../playout/lib'
import {
	defaultRundownPlaylist,
	defaultRundown,
	defaultSegment,
	defaultPart,
	defaultPiece,
	defaultAdLibPiece,
} from '../../../__mocks__/defaultCollectionObjects'
require('../expectedMediaItems') // include in order to create the Meteor methods needed

describe('Expected Media Items', () => {
	const rplId0: RundownPlaylistId = protectString('playlist0')
	const rplId1: RundownPlaylistId = protectString('playlist1')
	const rdId0: RundownId = protectString('rundown0')
	const rdId1: RundownId = protectString('rundown1')
	const mockPart0: PartId = protectString('mockPart0')
	const mockPiece0: PieceId = protectString('mockPiece0')
	const mockPart1: PartId = protectString('mockPart1')
	const mockPiece1: PieceId = protectString('mockPiece1')
	const mockAdLibPiece0: PieceId = protectString('mockAdLib0')
	const env = setupDefaultStudioEnvironment()

	const mockBase = '\\RAZ_DWA_TRZY\\C\\'
	const mockFileName0 = 'mockFileName0'
	const mockPath0 = mockBase + mockFileName0
	const mockFileName1 = 'mockFileName1'
	const mockPath1 = mockBase + mockFileName1

	const mockFlow0 = 'mockFlow0'
	const mockFlow1 = 'mockFlow1'

	function setupRundown(rdId: RundownId, rplId: RundownPlaylistId) {
		RundownPlaylists.insert({
			...defaultRundownPlaylist(rplId, env.studio._id, protectString('')),
			externalId: 'mock_rpl',
			name: 'Mock Playlist',

			// currentPartInstanceId: protectString(''),
			// previousPartInstanceId: protectString(''),
			// nextPartInstanceId: protectString(''),
			active: true,
		})

		Rundowns.insert(
			literal<DBRundown>({
				...defaultRundown(
					rdId,
					env.studio._id,
					env.ingestDevice._id,
					rplId,
					env.showStyleBase._id,
					env.showStyleVariant._id
				),
			})
		)
		Segments.insert(
			literal<DBSegment>({
				...defaultSegment(getRandomId(), rdId),
				_rank: 1,
			})
		)
		Parts.insert(
			literal<DBPart>({
				...defaultPart(protectString(rdId + '_' + mockPart0), rdId, protectString('')),
				_rank: 1,
				title: '',
			})
		)
		Pieces.insert(
			literal<Piece>({
				...defaultPiece(
					protectString(rdId + '_' + mockPiece0),
					rdId,
					protectString(''),
					protectString(rdId + '_' + mockPart0)
				),
				name: '',
				outputLayerId: LAYER_IDS.OUTPUT_PGM,
				sourceLayerId: LAYER_IDS.SOURCE_VT0,
				status: RundownAPI.PieceStatusCode.UNKNOWN,
				lifespan: PieceLifespan.OutOnSegmentChange,
				content: literal<VTContent>({
					fileName: mockFileName0,
					path: mockPath0,
					mediaFlowIds: [mockFlow0, mockFlow1],
					firstWords: '',
					lastWords: '',
					sourceDuration: 0,
					timelineObjects: [],
				}),
			})
		)
		Parts.insert(
			literal<DBPart>({
				...defaultPart(protectString(rdId + '_' + mockPart1), rdId, protectString('')),
				_rank: 1,
				externalId: '',
				title: '',
			})
		)
		Pieces.insert(
			literal<Piece>({
				...defaultPiece(
					protectString(rdId + '_' + mockPiece1),
					rdId,
					protectString(''),
					protectString(rdId + '_' + mockPart1)
				),
				name: '',
				outputLayerId: LAYER_IDS.OUTPUT_PGM,
				sourceLayerId: LAYER_IDS.SOURCE_VT0,
				status: RundownAPI.PieceStatusCode.UNKNOWN,
				lifespan: PieceLifespan.OutOnSegmentChange,
				content: literal<VTContent>({
					fileName: mockFileName1,
					path: mockPath1,
					mediaFlowIds: [mockFlow0],
					firstWords: '',
					lastWords: '',
					sourceDuration: 0,
					timelineObjects: [],
				}),
			})
		)
		AdLibPieces.insert(
			literal<AdLibPiece>({
				...defaultAdLibPiece(
					protectString(rdId + '_' + mockAdLibPiece0),
					rdId,
					protectString(rdId + '_' + mockPart1)
				),
				_id: protectString(rdId + '_' + mockAdLibPiece0),
				name: '',
				_rank: 0,
				lifespan: PieceLifespan.WithinPart,
				outputLayerId: LAYER_IDS.OUTPUT_PGM,
				sourceLayerId: LAYER_IDS.SOURCE_VT0,
				status: RundownAPI.PieceStatusCode.UNKNOWN,
				content: literal<VTContent>({
					fileName: mockFileName1,
					path: mockPath1,
					mediaFlowIds: [mockFlow0],
					firstWords: '',
					lastWords: '',
					sourceDuration: 0,
					timelineObjects: [],
				}),
			})
		)
	}

	beforeAllInFiber(() => {
		setupRundown(rdId0, rplId0)
		setupRundown(rdId1, rplId1)
	})

	describe('Based on a Rundown', () => {
		testInFiber('Generates ExpectedMediaItems based on a Rundown', () => {
			const cache = waitForPromise(initCacheForRundownPlaylistFromRundown(rdId0))
			updateExpectedMediaItemsOnRundown(cache, rdId0)
			waitForPromise(cache.saveAllToDatabase())

			const items = ExpectedMediaItems.find({
				rundownId: rdId0,
				studioId: env.studio._id,
			}).fetch()
			expect(items).toHaveLength(4)
		})
		testInFiber('Removes associated ExpectedMediaItems if a Rundown has been removed', () => {
			const rd = Rundowns.findOne(rdId0)
			if (!rd) {
				fail()
				return
			}
			const cache = waitForPromise(initCacheForRundownPlaylistFromRundown(rdId0))
			removeRundownFromCache(cache, rd)
			updateExpectedMediaItemsOnRundown(cache, rdId0)

			waitForPromise(cache.saveAllToDatabase())
			const items = ExpectedMediaItems.find({
				rundownId: rdId0,
				studioId: env.studio._id,
			}).fetch()
			expect(items).toHaveLength(0)
		})
	})

	describe('Based on a Part', () => {
		testInFiber('Generates ExpectedMediaItems based on a Part', () => {
			expect(Rundowns.findOne(rdId1)).toBeTruthy()
			expect(Parts.findOne(protectString(rdId1 + '_' + mockPart0))).toBeTruthy()
			expect(Pieces.find({ startPartId: protectString(rdId1 + '_' + mockPart0) }).count()).toBe(1)

			const cache = waitForPromise(initCacheForRundownPlaylistFromRundown(rdId1))
			updateExpectedMediaItemsOnPart(cache, rdId1, protectString(rdId1 + '_' + mockPart0))
			waitForPromise(cache.saveAllToDatabase())

			const items = ExpectedMediaItems.find({
				rundownId: rdId1,
				studioId: env.studio._id,
			}).fetch()
			expect(items).toHaveLength(2)
		})
		testInFiber('Removes all ExpectedMediaItems if a Part has been deleted', () => {
			Parts.remove({
				_id: protectString(rdId1 + '_' + mockPart0),
			})

			const cache = waitForPromise(initCacheForRundownPlaylistFromRundown(rdId1))
			updateExpectedMediaItemsOnPart(cache, rdId1, protectString(rdId1 + '_' + mockPart0))
			waitForPromise(cache.saveAllToDatabase())

			const items = ExpectedMediaItems.find({
				rundownId: rdId1,
				studioId: env.studio._id,
			}).fetch()
			expect(items).toHaveLength(0)
		})
		testInFiber('Removes all ExpectedMediaItems if a Rundown has been deleted', () => {
			const rd = Rundowns.findOne(rdId1)
			if (!rd) {
				fail()
				return
			}
			const cache = waitForPromise(initCacheForRundownPlaylistFromRundown(rd._id))

			updateExpectedMediaItemsOnPart(cache, rdId1, protectString(rdId1 + '_' + mockPart1))

			waitForPromise(cache.saveAllToDatabase())
			let items = ExpectedMediaItems.find({
				rundownId: rdId1,
				studioId: env.studio._id,
			}).fetch()
			expect(items).toHaveLength(2)

			cache.Rundowns.remove(rd._id)
			updateExpectedMediaItemsOnPart(cache, rdId1, protectString(rdId1 + '_' + mockPart1))

			waitForPromise(cache.saveAllToDatabase())
			items = ExpectedMediaItems.find({
				rundownId: rdId1,
				studioId: env.studio._id,
			}).fetch()
			expect(items).toHaveLength(0)
		})
	})

	return
})

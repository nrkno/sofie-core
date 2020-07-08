import { Random } from 'meteor/random'
import { Rundowns, DBRundown, RundownId } from '../../../lib/collections/Rundowns'
import { literal, protectString, getRandomId, waitForPromise } from '../../../lib/lib'
import { setLoggerLevel } from '../logger'
import { setupDefaultStudioEnvironment, LAYER_IDS } from '../../../__mocks__/helpers/database'
import { DBPart, Parts, PartId } from '../../../lib/collections/Parts'
import { VTContent, PieceLifespan } from 'tv-automation-sofie-blueprints-integration'
import { Segments, DBSegment } from '../../../lib/collections/Segments'
import { Pieces, Piece, PieceId } from '../../../lib/collections/Pieces'
import { RundownAPI } from '../../../lib/api/rundown'
import { updateExpectedMediaItemsOnRundown, updateExpectedMediaItemsOnPart } from '../expectedMediaItems'
import { ExpectedMediaItems } from '../../../lib/collections/ExpectedMediaItems'
import { testInFiber } from '../../../__mocks__/helpers/jest'
import { runInFiber } from '../../../__mocks__/Fibers'
import { AdLibPieces, AdLibPiece } from '../../../lib/collections/AdLibPieces'
import { RundownPlaylists, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import {
	wrapWithCacheForRundownPlaylistFromRundown,
	initCacheForRundownPlaylistFromRundown,
} from '../../DatabaseCaches'
import { removeRundownFromCache } from '../playout/lib'
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
			_id: rplId,
			externalId: 'mock_rpl',
			name: 'Mock Playlist',
			studioId: protectString(''),
			peripheralDeviceId: protectString(''),
			created: 0,
			modified: 0,
			currentPartInstanceId: protectString(''),
			previousPartInstanceId: protectString(''),
			nextPartInstanceId: protectString(''),
			active: true,
		})

		Rundowns.insert(
			literal<DBRundown>({
				_id: rdId,
				created: 0,
				dataSource: '',
				expectedDuration: 0,
				expectedStart: 0,
				externalId: '',
				importVersions: {
					blueprint: '',
					core: '',
					showStyleBase: '',
					showStyleVariant: '',
					studio: '',
				},
				metaData: {},
				modified: 0,
				name: 'Mock Rundown',
				peripheralDeviceId: env.ingestDevice._id,
				showStyleBaseId: env.showStyleBaseId,
				showStyleVariantId: env.showStyleVariantId,
				studioId: env.studio._id,
				playlistId: rplId,
				_rank: 0,
			})
		)
		Segments.insert(
			literal<DBSegment>({
				_id: getRandomId(),
				_rank: 1,
				externalId: '',
				metaData: {},
				name: '',
				rundownId: rdId,
				externalModified: 1,
			})
		)
		Parts.insert(
			literal<DBPart>({
				_id: protectString(rdId + '_' + mockPart0),
				_rank: 1,
				autoNext: false,
				autoNextOverlap: 0,
				classes: [],
				classesForNext: [],
				disableOutTransition: false,
				expectedDuration: 1,
				externalId: '',
				rundownId: rdId,
				segmentId: protectString(''),
				title: '',
			})
		)
		Pieces.insert(
			literal<Piece>({
				_id: protectString(rdId + '_' + mockPiece0),
				name: '',
				enable: {
					start: 0,
				},
				adlibPreroll: 0,
				externalId: '',
				metaData: {},
				outputLayerId: LAYER_IDS.OUTPUT_PGM,
				startPartId: protectString(rdId + '_' + mockPart0),
				startSegmentId: protectString(''),
				startRundownId: rdId,
				sourceLayerId: LAYER_IDS.SOURCE_VT0,
				status: RundownAPI.PieceStatusCode.UNKNOWN,
				lifespan: PieceLifespan.OutOnSegmentChange,
				invalid: false,
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
				_id: protectString(rdId + '_' + mockPart1),
				_rank: 1,
				autoNext: false,
				autoNextOverlap: 0,
				classes: [],
				classesForNext: [],
				disableOutTransition: false,
				expectedDuration: 1,
				externalId: '',
				rundownId: rdId,
				segmentId: protectString(''),
				title: '',
			})
		)
		Pieces.insert(
			literal<Piece>({
				_id: protectString(rdId + '_' + mockPiece1),
				name: '',
				enable: {
					start: 0,
				},
				adlibPreroll: 0,
				externalId: '',
				metaData: {},
				outputLayerId: LAYER_IDS.OUTPUT_PGM,
				startPartId: protectString(rdId + '_' + mockPart1),
				startSegmentId: protectString(''),
				startRundownId: rdId,
				sourceLayerId: LAYER_IDS.SOURCE_VT0,
				status: RundownAPI.PieceStatusCode.UNKNOWN,
				lifespan: PieceLifespan.OutOnSegmentChange,
				invalid: false,
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
				_id: protectString(rdId + '_' + mockAdLibPiece0),
				name: '',
				_rank: 0,
				adlibPreroll: 0,
				expectedDuration: 0,
				externalId: '',
				lifespan: PieceLifespan.WithinPart,
				invalid: false,
				metaData: {},
				outputLayerId: LAYER_IDS.OUTPUT_PGM,
				partId: protectString(rdId + '_' + mockPart1),
				rundownId: rdId,
				sourceLayerId: LAYER_IDS.SOURCE_VT0,
				status: RundownAPI.PieceStatusCode.UNKNOWN,
				// trigger: undefined,
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

	beforeAll(() =>
		runInFiber(() => {
			setupRundown(rdId0, rplId0)
			setupRundown(rdId1, rplId1)
		})
	)

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
			expect(Pieces.find({ partId: protectString(rdId1 + '_' + mockPart0) }).count()).toBe(1)

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

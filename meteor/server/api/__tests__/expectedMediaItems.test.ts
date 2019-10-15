import { Random } from 'meteor/random'
import { Rundowns, DBRundown } from '../../../lib/collections/Rundowns'
import { literal } from '../../../lib/lib'
import { setLoggerLevel } from '../logger'
import { setupDefaultStudioEnvironment, LAYER_IDS } from '../../../__mocks__/helpers/database'
import { DBPart, Parts } from '../../../lib/collections/Parts'
import { VTContent, PieceLifespan } from 'tv-automation-sofie-blueprints-integration'
import { Segments, DBSegment } from '../../../lib/collections/Segments'
import { Pieces, Piece } from '../../../lib/collections/Pieces'
import { RundownAPI } from '../../../lib/api/rundown'
import { updateExpectedMediaItemsOnRundown, updateExpectedMediaItemsOnPart } from '../expectedMediaItems'
import { ExpectedMediaItems } from '../../../lib/collections/ExpectedMediaItems'
import { testInFiber } from '../../../__mocks__/helpers/jest'
import { runInFiber } from '../../../__mocks__/Fibers'
import { AdLibPieces, AdLibPiece } from '../../../lib/collections/AdLibPieces'
require('../expectedMediaItems') // include in order to create the Meteor methods needed

describe('Expected Media Items', () => {
	const rdId0 = 'rundown0'
	const rdId1 = 'rundown1'
	const mockPart0 = 'mockPart0'
	const mockPiece0 = 'mockPiece0'
	const mockPart1 = 'mockPart1'
	const mockPiece1 = 'mockPiece1'
	const mockAdLibPiece0 = 'mockAdLib0'
	const env = setupDefaultStudioEnvironment()

	const mockBase = '\\RAZ_DWA_TRZY\\C\\'
	const mockFileName0 = 'mockFileName0'
	const mockPath0 = mockBase + mockFileName0
	const mockFileName1 = 'mockFileName1'
	const mockPath1 = mockBase + mockFileName1

	const mockFlow0 = 'mockFlow0'
	const mockFlow1 = 'mockFlow1'

	function setupRundown (rdId) {
		Rundowns.insert(literal<DBRundown>({
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
				studio: ''
			},
			metaData: {},
			modified: 0,
			name: 'Mock Rundown',
			nextPartId: '',
			peripheralDeviceId: env.ingestDevice._id,
			currentPartId: '',
			previousPartId: '',
			showStyleBaseId: env.showStyleBaseId,
			showStyleVariantId: env.showStyleVariantId,
			studioId: env.studio._id
		}))
		Segments.insert(literal<DBSegment>({
			_id: Random.id(),
			_rank: 1,
			externalId: '',
			metaData: {},
			name: '',
			rundownId: rdId
		}))
		Parts.insert(literal<DBPart>({
			_id: rdId + '_' + mockPart0,
			_rank: 1,
			autoNext: false,
			autoNextOverlap: 0,
			classes: [],
			classesForNext: [],
			disableOutTransition: false,
			expectedDuration: 1,
			externalId: '',
			rundownId: rdId,
			segmentId: '',
			title: '',
			typeVariant: ''
		}))
		Pieces.insert(literal<Piece>({
			_id: rdId + '_' + mockPiece0,
			name: '',
			enable: {
				start: 0
			},
			adlibPreroll: 0,
			externalId: '',
			metaData: {},
			outputLayerId: LAYER_IDS.OUTPUT_PGM,
			partId: rdId + '_' + mockPart0,
			rundownId: rdId,
			sourceLayerId: LAYER_IDS.SOURCE_VT0,
			status: RundownAPI.PieceStatusCode.UNKNOWN,
			content: literal<VTContent>({
				fileName: mockFileName0,
				path: mockPath0,
				mediaFlowIds: [ mockFlow0, mockFlow1 ],
				firstWords: '',
				lastWords: '',
				sourceDuration: 0,
				timelineObjects: []
			})
		}))
		Parts.insert(literal<DBPart>({
			_id: rdId + '_' + mockPart1,
			_rank: 1,
			autoNext: false,
			autoNextOverlap: 0,
			classes: [],
			classesForNext: [],
			disableOutTransition: false,
			expectedDuration: 1,
			externalId: '',
			rundownId: rdId,
			segmentId: '',
			title: '',
			typeVariant: ''
		}))
		Pieces.insert(literal<Piece>({
			_id: rdId + '_' + mockPiece1,
			name: '',
			enable: {
				start: 0,
			},
			adlibPreroll: 0,
			externalId: '',
			metaData: {},
			outputLayerId: LAYER_IDS.OUTPUT_PGM,
			partId: rdId + '_' + mockPart1,
			rundownId: rdId,
			sourceLayerId: LAYER_IDS.SOURCE_VT0,
			status: RundownAPI.PieceStatusCode.UNKNOWN,
			content: literal<VTContent>({
				fileName: mockFileName1,
				path: mockPath1,
				mediaFlowIds: [mockFlow0],
				firstWords: '',
				lastWords: '',
				sourceDuration: 0,
				timelineObjects: []
			})
		}))
		AdLibPieces.insert(literal<AdLibPiece>({
			_id: rdId + '_' + mockAdLibPiece0,
			name: '',
			_rank: 0,
			adlibPreroll: 0,
			disabled: false,
			expectedDuration: 0,
			externalId: '',
			infiniteMode: PieceLifespan.Normal,
			invalid: false,
			metaData: {},
			outputLayerId: LAYER_IDS.OUTPUT_PGM,
			partId: rdId + '_' + mockPart1,
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
				timelineObjects: []
			})
		}))
	}

	beforeAll(() => runInFiber(() => {
		setupRundown(rdId0)
		setupRundown(rdId1)
	}))

	describe('Based on a Rundown', () => {
		testInFiber('Generates ExpectedMediaItems based on a Rundown', () => {
			updateExpectedMediaItemsOnRundown(rdId0)

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
			rd.remove()

			updateExpectedMediaItemsOnRundown(rdId0)

			const items = ExpectedMediaItems.find({
				rundownId: rdId0,
				studioId: env.studio._id
			}).fetch()
			expect(items).toHaveLength(0)
		})
	})

	describe('Based on a Part', () => {
		testInFiber('Generates ExpectedMediaItems based on a Part', () => {
			expect(Rundowns.findOne(rdId1)).toBeTruthy()
			expect(Parts.findOne(rdId1 + '_' + mockPart0)).toBeTruthy()
			expect(Pieces.find({ partId: rdId1 + '_' + mockPart0 }).count()).toBe(1)

			updateExpectedMediaItemsOnPart(rdId1, rdId1 + '_' + mockPart0)

			const items = ExpectedMediaItems.find({
				rundownId: rdId1,
				studioId: env.studio._id
			}).fetch()
			expect(items).toHaveLength(2)
		})
		testInFiber('Removes all ExpectedMediaItems if a Part has been deleted', () => {
			Parts.remove({
				_id: rdId1 + '_' + mockPart0
			})

			updateExpectedMediaItemsOnPart(rdId1, rdId1 + '_' + mockPart0)

			const items = ExpectedMediaItems.find({
				rundownId: rdId1,
				studioId: env.studio._id
			}).fetch()
			expect(items).toHaveLength(0)
		})
		testInFiber('Removes all ExpectedMediaItems if a Rundown has been deleted', () => {
			const rd = Rundowns.findOne(rdId1)
			if (!rd) {
				fail()
				return
			}

			updateExpectedMediaItemsOnPart(rdId1, rdId1 + '_' + mockPart1)

			let items = ExpectedMediaItems.find({
				rundownId: rdId1,
				studioId: env.studio._id
			}).fetch()
			expect(items).toHaveLength(2)

			Rundowns.remove(rd._id)
			updateExpectedMediaItemsOnPart(rdId1, rdId1 + '_' + mockPart1)

			items = ExpectedMediaItems.find({
				rundownId: rdId1,
				studioId: env.studio._id
			}).fetch()
			expect(items).toHaveLength(0)
		})
	})

	return
})

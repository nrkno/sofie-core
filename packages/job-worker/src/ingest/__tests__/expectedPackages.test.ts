import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { defaultPart, defaultPiece, defaultAdLibPiece } from '../../__mocks__/defaultCollectionObjects.js'
import { LAYER_IDS } from '../../__mocks__/presetCollections.js'
import { ExpectedPackage, PieceLifespan, VTContent } from '@sofie-automation/blueprints-integration'
import { updateExpectedPackagesForPartModel } from '../expectedPackages.js'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context.js'
import { ReadonlyDeep } from 'type-fest'
import { IngestPartModel } from '../model/IngestPartModel.js'

describe('Expected Media Items', () => {
	let context: MockJobContext
	beforeAll(async () => {
		context = setupDefaultJobEnvironment()
	})

	const getExpectedPackage = (id: string, filePath: string) => {
		return literal<ExpectedPackage.ExpectedPackageMediaFile>({
			_id: id,
			layers: ['layer0'],
			contentVersionHash: 'abc',
			type: ExpectedPackage.PackageType.MEDIA_FILE,
			content: {
				filePath: filePath,
			},
			version: {},
			sources: [
				{
					containerId: 'source0',
					accessors: {},
				},
			],
			sideEffect: {},
		})
	}

	function getMockPartContent() {
		const mockBase = '\\RAZ_DWA_TRZY\\C\\'
		const mockFileName0 = 'mockFileName0'
		const mockPath0 = mockBase + mockFileName0
		const mockFileName1 = 'mockFileName1'
		const mockPath1 = mockBase + mockFileName1

		const mockFlow0 = 'mockFlow0'
		const mockFlow1 = 'mockFlow1'

		const part: ReadonlyDeep<DBPart> = literal<DBPart>({
			...defaultPart(protectString('mockPart0'), protectString(''), protectString('')),
			_rank: 1,
			title: '',
		})

		const pieces: ReadonlyDeep<Piece>[] = [
			literal<Piece>({
				...defaultPiece(
					protectString('mockPiece0'),
					protectString(''),
					protectString(''),
					protectString('mockPart0')
				),
				name: '',
				outputLayerId: LAYER_IDS.OUTPUT_PGM,
				sourceLayerId: LAYER_IDS.SOURCE_VT0,
				lifespan: PieceLifespan.OutOnSegmentChange,
				content: literal<VTContent>({
					fileName: mockFileName0,
					path: mockPath0,
					mediaFlowIds: [mockFlow0, mockFlow1],
					sourceDuration: 0,
				}),
				expectedPackages: [getExpectedPackage('id0', mockPath0), getExpectedPackage('id1', mockPath0)],
				expectedPlayoutItems: undefined,
			}),
			literal<Piece>({
				...defaultPiece(
					protectString('mockPiece1'),
					protectString(''),
					protectString(''),
					protectString('mockPart0')
				),
				name: '',
				outputLayerId: LAYER_IDS.OUTPUT_PGM,
				sourceLayerId: LAYER_IDS.SOURCE_VT0,
				lifespan: PieceLifespan.OutOnSegmentChange,
				content: literal<VTContent>({
					fileName: mockFileName1,
					path: mockPath1,
					mediaFlowIds: [mockFlow0],
					sourceDuration: 0,
				}),
				expectedPackages: [getExpectedPackage('id0', mockPath1)],
				expectedPlayoutItems: undefined,
			}),
		]

		const adLibPieces: ReadonlyDeep<AdLibPiece>[] = [
			literal<AdLibPiece>({
				...defaultAdLibPiece(protectString('mockAdLib0'), protectString(''), protectString('mockPart0')),
				name: '',
				_rank: 0,
				lifespan: PieceLifespan.WithinPart,
				outputLayerId: LAYER_IDS.OUTPUT_PGM,
				sourceLayerId: LAYER_IDS.SOURCE_VT0,
				content: literal<VTContent>({
					fileName: mockFileName1,
					path: mockPath1,
					mediaFlowIds: [mockFlow0],
					sourceDuration: 0,
				}),
				expectedPackages: [getExpectedPackage('id0', mockPath1)],
			}),
		]

		return { part, pieces, adLibPieces }
	}

	test('Generates ExpectedPackages(/ExpectedMediaItems) for a Part', async () => {
		const setExpectedMediaItems = jest.fn()
		const setExpectedPlayoutItems = jest.fn()
		const setExpectedPackages = jest.fn()

		const { part, pieces, adLibPieces } = getMockPartContent()

		const partModel: IngestPartModel = {
			part,
			pieces,
			adLibActions: [],
			adLibPieces,
			expectedMediaItems: [],
			expectedPlayoutItems: [],
			expectedPackages: [],

			setExpectedMediaItems,
			setExpectedPlayoutItems,
			setExpectedPackages,
			setInvalid: function (_invalid: boolean): void {
				throw new Error('Function not implemented.')
			},
		}

		updateExpectedPackagesForPartModel(context, partModel)

		expect(setExpectedPackages).toHaveBeenCalledTimes(1)
		expect(setExpectedPackages.mock.calls[0][0]).toHaveLength(4)

		expect(setExpectedPlayoutItems).toHaveBeenCalledTimes(1)
		expect(setExpectedPlayoutItems).toHaveBeenCalledWith([])

		// to be deprecated:
		expect(setExpectedMediaItems).toHaveBeenCalledTimes(1)
		expect(setExpectedMediaItems.mock.calls[0][0]).toHaveLength(4)
	})
})

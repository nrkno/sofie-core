import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { RundownPlaylistId, RundownId, PartId, PieceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece, PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { literal, getRandomId } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import {
	defaultRundownPlaylist,
	defaultRundown,
	defaultSegment,
	defaultPart,
	defaultPiece,
	defaultAdLibPiece,
} from '../../__mocks__/defaultCollectionObjects'
import { LAYER_IDS, setupMockShowStyleCompound } from '../../__mocks__/presetCollections'
import { ExpectedPackage, PieceLifespan, VTContent } from '@sofie-automation/blueprints-integration'
import { updateExpectedPackagesOnRundown } from '../expectedPackages'
import { runIngestJob, UpdateIngestRundownAction } from '../lock'
import { MockJobContext, setupDefaultJobEnvironment } from '../../__mocks__/context'
import { ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleCompound'
import { ReadonlyDeep } from 'type-fest'

describe('Expected Media Items', () => {
	const rplId0: RundownPlaylistId = protectString('playlist0')
	const rplId1: RundownPlaylistId = protectString('playlist1')
	const rdExtId0 = 'rundown0'
	const rdExtId1 = 'rundown1'
	let rdId0: RundownId = protectString('rundown0')
	const mockPart0: PartId = protectString('mockPart0')
	const mockPiece0: PieceId = protectString('mockPiece0')
	const mockPart1: PartId = protectString('mockPart1')
	const mockPiece1: PieceId = protectString('mockPiece1')
	const mockAdLibPiece0: PieceId = protectString('mockAdLib0')

	const mockBase = '\\RAZ_DWA_TRZY\\C\\'
	const mockFileName0 = 'mockFileName0'
	const mockPath0 = mockBase + mockFileName0
	const mockFileName1 = 'mockFileName1'
	const mockPath1 = mockBase + mockFileName1

	const mockFlow0 = 'mockFlow0'
	const mockFlow1 = 'mockFlow1'

	let context: MockJobContext
	let showStyleCompound: ReadonlyDeep<ShowStyleCompound>
	beforeAll(async () => {
		context = setupDefaultJobEnvironment()

		showStyleCompound = await setupMockShowStyleCompound(context)
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

	async function setupRundown(rdId: string, rplId: RundownPlaylistId): Promise<RundownId> {
		await context.directCollections.RundownPlaylists.insertOne({
			...defaultRundownPlaylist(rplId, context.studioId),
			externalId: 'mock_rpl',
			name: 'Mock Playlist',

			// currentPartInstanceId: protectString(''),
			// previousPartInstanceId: protectString(''),
			// nextPartInstanceId: protectString(''),
			activationId: protectString('active'),
		})

		const rd = literal<DBRundown>({
			...defaultRundown(
				rdId,
				context.studioId,
				null,
				rplId,
				showStyleCompound._id,
				showStyleCompound.showStyleVariantId
			),
		})
		await context.directCollections.Rundowns.insertOne(rd)
		await context.directCollections.Segments.insertOne(
			literal<DBSegment>({
				...defaultSegment(getRandomId(), rd._id),
				_rank: 1,
			})
		)
		await context.directCollections.Parts.insertOne(
			literal<DBPart>({
				...defaultPart(protectString(rdId + '_' + mockPart0), rd._id, protectString('segment1')),
				_rank: 1,
				title: '',
			})
		)
		await context.directCollections.Pieces.insertOne(
			literal<Piece>({
				...defaultPiece(
					protectString(rdId + '_' + mockPiece0),
					rd._id,
					protectString(''),
					protectString(rdId + '_' + mockPart0)
				),
				name: '',
				outputLayerId: LAYER_IDS.OUTPUT_PGM,
				sourceLayerId: LAYER_IDS.SOURCE_VT0,
				status: PieceStatusCode.UNKNOWN,
				lifespan: PieceLifespan.OutOnSegmentChange,
				content: literal<VTContent>({
					fileName: mockFileName0,
					path: mockPath0,
					mediaFlowIds: [mockFlow0, mockFlow1],
					sourceDuration: 0,
				}),
				expectedPackages: [getExpectedPackage('id0', mockPath0), getExpectedPackage('id1', mockPath0)],
			})
		)
		await context.directCollections.Parts.insertOne(
			literal<DBPart>({
				...defaultPart(protectString(rdId + '_' + mockPart1), rd._id, protectString('segment1')),
				_rank: 1,
				externalId: '',
				title: '',
			})
		)
		await context.directCollections.Pieces.insertOne(
			literal<Piece>({
				...defaultPiece(
					protectString(rdId + '_' + mockPiece1),
					rd._id,
					protectString(''),
					protectString(rdId + '_' + mockPart1)
				),
				name: '',
				outputLayerId: LAYER_IDS.OUTPUT_PGM,
				sourceLayerId: LAYER_IDS.SOURCE_VT0,
				status: PieceStatusCode.UNKNOWN,
				lifespan: PieceLifespan.OutOnSegmentChange,
				content: literal<VTContent>({
					fileName: mockFileName1,
					path: mockPath1,
					mediaFlowIds: [mockFlow0],
					sourceDuration: 0,
				}),
				expectedPackages: [getExpectedPackage('id0', mockPath1)],
			})
		)
		await context.directCollections.AdLibPieces.insertOne(
			literal<AdLibPiece>({
				...defaultAdLibPiece(
					protectString(rdId + '_' + mockAdLibPiece0),
					rd._id,
					protectString(rdId + '_' + mockPart1)
				),
				_id: protectString(rdId + '_' + mockAdLibPiece0),
				name: '',
				_rank: 0,
				lifespan: PieceLifespan.WithinPart,
				outputLayerId: LAYER_IDS.OUTPUT_PGM,
				sourceLayerId: LAYER_IDS.SOURCE_VT0,
				status: PieceStatusCode.UNKNOWN,
				content: literal<VTContent>({
					fileName: mockFileName1,
					path: mockPath1,
					mediaFlowIds: [mockFlow0],
					sourceDuration: 0,
				}),
				expectedPackages: [getExpectedPackage('id0', mockPath1)],
			})
		)
		return rd._id
	}

	beforeAll(async () => {
		rdId0 = await setupRundown(rdExtId0, rplId0)
		await setupRundown(rdExtId1, rplId1)
	})

	describe('Based on a Rundown', () => {
		test('Generates ExpectedPackages(/ExpectedMediaItems) based on a Rundown', async () => {
			const rundown = (await context.directCollections.Rundowns.findOne(rdId0)) as DBRundown
			expect(rundown).toBeTruthy()

			await runIngestJob(
				context,
				{ rundownExternalId: rundown.externalId, peripheralDeviceId: null },
				(oldIngest) => oldIngest ?? UpdateIngestRundownAction.DELETE,
				async (_context, cache) => {
					await updateExpectedPackagesOnRundown(context, cache)

					return {
						changedSegmentIds: [],
						removedSegmentIds: [],
						renamedSegments: new Map(),
						removeRundown: false,
						blueprint: undefined,
						showStyle: undefined,
					}
				}
			)

			const packages = await context.directCollections.ExpectedPackages.findFetch({
				rundownId: rdId0,
				studioId: context.studioId,
			})
			expect(packages).toHaveLength(4)

			// to be deprecated:
			const items = await context.directCollections.ExpectedMediaItems.findFetch({
				rundownId: rdId0,
				studioId: context.studioId,
			})
			expect(items).toHaveLength(4)
		})
	})
})

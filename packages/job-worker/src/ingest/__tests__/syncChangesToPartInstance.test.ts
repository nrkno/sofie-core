/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/unbound-method */
import { setupDefaultJobEnvironment } from '../../__mocks__/context'
import { setupMockShowStyleCompound } from '../../__mocks__/presetCollections'
import { findInstancesToSync, PartInstanceToSync, SyncChangesToPartInstancesWorker } from '../syncChangesToPartInstance'
import { mock } from 'jest-mock-extended'
import type { PlayoutModel } from '../../playout/model/PlayoutModel'
import type { IngestModelReadonly } from '../model/IngestModel'
import type { PlayoutRundownModel } from '../../playout/model/PlayoutRundownModel'
import type { PlayoutPartInstanceModel } from '../../playout/model/PlayoutPartInstanceModel'
import type { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'

jest.mock('../../playout/adlibTesting')
import { validateAdlibTestingPartInstanceProperties } from '../../playout/adlibTesting'

const mockOptions = {
	fallbackMockImplementation: () => {
		throw new Error('not mocked')
	},
	funcPropSupport: true,
}

function createMockPart(id: string): DBPart {
	return {
		_id: protectString(id),
		_rank: 1,
		externalId: 'mockPartExternalId',
		segmentId: protectString('mockSegmentId'),
		rundownId: protectString('mockRundownId'),
		title: 'mockPartTitle',
		expectedDurationWithTransition: undefined,
		userEditOperations: undefined,
	}
}

describe('SyncChangesToPartInstancesWorker', () => {
	describe('findInstancesToSync', () => {
		function createMockPlayoutModel(): PlayoutModel {
			return mock<PlayoutModel>(
				{
					currentPartInstance: null,
					nextPartInstance: null,
					previousPartInstance: null,
				},
				mockOptions
			)
		}
		function createMockPlayoutRundownModel(): PlayoutRundownModel {
			return mock<PlayoutRundownModel>({}, mockOptions)
		}
		function createMockIngestModelReadonly(): IngestModelReadonly {
			return mock<IngestModelReadonly>({}, mockOptions)
		}

		test('No partInstances', async () => {
			const context = setupDefaultJobEnvironment()

			const playoutModel = createMockPlayoutModel()
			const ingestModel = createMockIngestModelReadonly()
			const rundownModel = createMockPlayoutRundownModel()

			const instancesToSync = findInstancesToSync(context, playoutModel, ingestModel, rundownModel)
			expect(instancesToSync).toHaveLength(0)
		})

		// TODO - this needs a lot more fleshing out
	})

	describe('syncChangesToPartInstance', () => {
		function createMockPlayoutModel(partialModel?: Partial<Pick<PlayoutModel, 'nextPartInstance'>>) {
			return mock<PlayoutModel>(
				{
					currentPartInstance: null,
					nextPartInstance: partialModel?.nextPartInstance ?? null,
					previousPartInstance: null,

					clearAllNotifications: jest.fn(),
					// setPartInstanceAsNext: jest.fn(),
					// removeUntakenPartInstances: jest.fn(),
				},
				mockOptions
			)
		}
		function createMockPlayoutRundownModel(): PlayoutRundownModel {
			return mock<PlayoutRundownModel>({}, mockOptions)
		}
		function createMockIngestModelReadonly(): IngestModelReadonly {
			return mock<IngestModelReadonly>(
				{
					findPart: jest.fn(() => undefined),
					getGlobalPieces: jest.fn(() => []),
				},
				mockOptions
			)
		}

		function createMockPartInstance(id: string): PlayoutPartInstanceModel {
			return mock<PlayoutPartInstanceModel>(
				{
					partInstance: {
						_id: protectString(id),
						part: createMockPart(id),
						segmentId: protectString('mockSegmentId'),
						rundownId: protectString('mockRundownId'),
						takeCount: 0,
						rehearsal: false,
						playlistActivationId: protectString('mockPlaylistActivationId'),
						segmentPlayoutId: protectString('mockSegmentPlayoutId'),
					} satisfies PlayoutPartInstanceModel['partInstance'],
					pieceInstances: [] satisfies PlayoutPartInstanceModel['pieceInstances'],

					recalculateExpectedDurationWithTransition: jest.fn(),
					snapshotMakeCopy: jest.fn(() => Date.now() as any),
					snapshotRestore: jest.fn(() => {
						throw new Error('snapshotRestore not expected')
					}),
				},
				mockOptions
			)
		}

		beforeEach(() => {
			jest.clearAllMocks()
		})

		test('successful with empty blueprint method', async () => {
			const context = setupDefaultJobEnvironment()
			const showStyleCompound = await setupMockShowStyleCompound(context)

			const syncIngestUpdateToPartInstanceFn = jest.fn()
			context.updateShowStyleBlueprint({
				syncIngestUpdateToPartInstance: syncIngestUpdateToPartInstanceFn,
			})
			const blueprint = await context.getShowStyleBlueprint(showStyleCompound._id)

			const playoutModel = createMockPlayoutModel()
			const ingestModel = createMockIngestModelReadonly()
			const rundownModel = createMockPlayoutRundownModel()

			const worker = new SyncChangesToPartInstancesWorker(
				context,
				playoutModel,
				ingestModel,
				showStyleCompound,
				blueprint
			)

			const partInstance = createMockPartInstance('mockPartInstanceId')
			const part = createMockPart('mockPartId')

			const instanceToSync: PartInstanceToSync = {
				playoutRundownModel: rundownModel,
				existingPartInstance: partInstance,
				previousPartInstance: null,
				playStatus: 'next',
				newPart: part,
				proposedPieceInstances: Promise.resolve([]),
			}

			await worker.syncChangesToPartInstance(instanceToSync)

			expect(partInstance.snapshotMakeCopy).toHaveBeenCalledTimes(1)
			expect(partInstance.snapshotRestore).toHaveBeenCalledTimes(0)
			expect(syncIngestUpdateToPartInstanceFn).toHaveBeenCalledTimes(1)
			expect(validateAdlibTestingPartInstanceProperties).toHaveBeenCalledTimes(1)
		})
	})
})

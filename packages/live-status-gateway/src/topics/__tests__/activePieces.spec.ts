import { makeMockLogger, makeMockSubscriber, makeTestPlaylist, makeTestShowStyleBase } from './utils'
import { PlaylistHandler } from '../../collections/playlistHandler'
import { ShowStyleBaseExt, ShowStyleBaseHandler } from '../../collections/showStyleBaseHandler'
import { protectString } from '@sofie-automation/server-core-integration/dist'
import { PartialDeep } from 'type-fest'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { PieceInstancesHandler, SelectedPieceInstances } from '../../collections/pieceInstancesHandler'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ActivePiecesStatus, ActivePiecesTopic } from '../activePiecesTopic'

describe('ActivePiecesTopic', () => {
	it('provides active pieces', async () => {
		const topic = new ActivePiecesTopic(makeMockLogger())
		const mockSubscriber = makeMockSubscriber()

		const currentPartInstanceId = 'CURRENT_PART_INSTANCE_ID'

		const playlist = makeTestPlaylist()
		playlist.activationId = protectString('somethingRandom')
		playlist.currentPartInfo = {
			consumesQueuedSegmentId: false,
			manuallySelected: false,
			partInstanceId: protectString(currentPartInstanceId),
			rundownId: playlist.rundownIdsInOrder[0],
		}
		await topic.update(PlaylistHandler.name, playlist)

		const testShowStyleBase = makeTestShowStyleBase()
		await topic.update(ShowStyleBaseHandler.name, testShowStyleBase as ShowStyleBaseExt)

		const testPieceInstances: PartialDeep<SelectedPieceInstances> = {
			currentPartInstance: [],
			nextPartInstance: [],
			active: [
				literal<PartialDeep<PieceInstance>>({
					_id: protectString('PIECE_1'),
					piece: {
						name: 'Piece 1',
						outputLayerId: 'pgm',
						sourceLayerId: 'layer0',
						tags: ['my_tag'],
						publicData: { c: 'd' },
					},
				}),
			] as PieceInstance[],
		}
		await topic.update(PieceInstancesHandler.name, testPieceInstances as SelectedPieceInstances)

		topic.addSubscriber(mockSubscriber)

		const expectedStatus: PartialDeep<ActivePiecesStatus> = {
			event: 'activePieces',

			activePieces: [
				{
					id: 'PIECE_1',
					name: 'Piece 1',
					sourceLayer: 'Layer 0',
					outputLayer: 'PGM',
					tags: ['my_tag'],
					publicData: { c: 'd' },
				},
			],
		}

		// eslint-disable-next-line @typescript-eslint/unbound-method
		expect(mockSubscriber.send).toHaveBeenCalledTimes(1)
		expect(JSON.parse(mockSubscriber.send.mock.calls[0][0] as string)).toMatchObject(expectedStatus)
	})
})

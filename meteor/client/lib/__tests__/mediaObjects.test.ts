import {
	PackageInfo,
	PieceLifespan,
	VTContent,
	ISourceLayer,
	SourceLayerType,
} from '@sofie-automation/blueprints-integration'
import {
	PieceGeneric,
	PieceStatusCode,
	EmptyPieceTimelineObjectsBlob,
} from '@sofie-automation/corelib/dist/dataModel/Piece'
import { IStudioSettings } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import {
	MediaObject,
	MediaInfo,
	MediaStreamType,
	MediaStream,
} from '@sofie-automation/shared-lib/dist/core/model/MediaObjects'
import { UIStudio } from '../../../lib/api/studios'
import { MediaObjects } from '../../collections'
import { defaultStudio } from '../../../__mocks__/defaultCollectionObjects'
import { testInFiber } from '../../../__mocks__/helpers/jest'
import { MongoMock } from '../../../__mocks__/mongo'
import { checkPieceContentStatus } from '../mediaObjects'

const mockMediaObjectsCollection = MongoMock.getInnerMockCollection(MediaObjects)

describe('client/lib/mediaObjects', () => {
	testInFiber('checkPieceContentStatus', () => {
		const mockStudioSettings: IStudioSettings = {
			supportedMediaFormats: '1920x1080i5000, 1280x720, i5000, i5000tff',
			mediaPreviewsUrl: '',
			supportedAudioStreams: '4',
			frameRate: 25,
		}

		const mockDefaultStudio = defaultStudio(protectString('studio0'))
		const mockStudio: Pick<UIStudio, '_id' | 'settings' | 'packageContainers' | 'mappings' | 'routeSets'> = {
			...mockDefaultStudio,
			settings: mockStudioSettings,
			mappings: applyAndValidateOverrides(mockDefaultStudio.mappingsWithOverrides).obj,
		}

		mockMediaObjectsCollection.insert(
			literal<MediaObject>({
				_id: protectString(''),
				_attachments: {},
				_rev: '',
				cinf: '',
				collectionId: 'studio0',
				mediaId: 'TEST_FILE',
				mediaPath: '',
				mediaSize: 0,
				mediaTime: 0,
				mediainfo: literal<MediaInfo>({
					name: 'test_file',
					field_order: PackageInfo.FieldOrder.TFF,
					streams: [
						literal<MediaStream>({
							width: 1920,
							height: 1080,
							codec: {
								type: MediaStreamType.Video,
								time_base: '1/50',
							},
						}),
						literal<MediaStream>({
							channels: 1,
							codec: {
								type: MediaStreamType.Audio,
								time_base: '1/25',
							},
						}),
						literal<MediaStream>({
							channels: 1,
							codec: {
								type: MediaStreamType.Audio,
								time_base: '1/25',
							},
						}),
						literal<MediaStream>({
							channels: 1,
							codec: {
								type: MediaStreamType.Audio,
								time_base: '1/25',
							},
						}),
						literal<MediaStream>({
							channels: 1,
							codec: {
								type: MediaStreamType.Audio,
								time_base: '1/25',
							},
						}),
					],
				}),
				objId: '',
				previewPath: '',
				previewSize: 0,
				previewTime: 0,
				studioId: protectString('studio0'),
				thumbSize: 0,
				thumbTime: 0,
				tinf: '',
			})
		)

		const piece1 = literal<PieceGeneric>({
			_id: protectString('piece1'),
			status: PieceStatusCode.UNKNOWN,
			name: 'Test_file',
			prerollDuration: 0,
			externalId: '',
			lifespan: PieceLifespan.WithinPart,
			metaData: {},
			outputLayerId: '',
			sourceLayerId: '',
			content: literal<VTContent>({
				fileName: 'test_file',
				path: '',
			}),
			timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		})

		const sourcelayer1 = literal<ISourceLayer>({
			_id: '',
			_rank: 0,
			name: '',
			type: SourceLayerType.LIVE_SPEAK,
		})

		mockMediaObjectsCollection.insert(
			literal<MediaObject>({
				_id: protectString(''),
				_attachments: {},
				_rev: '',
				cinf: '',
				collectionId: 'studio0',
				mediaId: 'TEST_FILE_2',
				mediaPath: '',
				mediaSize: 0,
				mediaTime: 0,
				mediainfo: literal<MediaInfo>({
					name: 'test_file_2',
					field_order: PackageInfo.FieldOrder.Progressive,
					streams: [
						literal<MediaStream>({
							width: 1920,
							height: 1080,
							codec: {
								type: MediaStreamType.Video,
								time_base: '1/50',
							},
						}),
						literal<MediaStream>({
							channels: 1,
							codec: {
								type: MediaStreamType.Audio,
								time_base: '1/25',
							},
						}),
						literal<MediaStream>({
							channels: 1,
							codec: {
								type: MediaStreamType.Audio,
								time_base: '1/25',
							},
						}),
						literal<MediaStream>({
							channels: 1,
							codec: {
								type: MediaStreamType.Audio,
								time_base: '1/25',
							},
						}),
						literal<MediaStream>({
							channels: 1,
							codec: {
								type: MediaStreamType.Audio,
								time_base: '1/25',
							},
						}),
					],
				}),
				objId: '',
				previewPath: '',
				previewSize: 0,
				previewTime: 0,
				studioId: protectString('studio0'),
				thumbSize: 0,
				thumbTime: 0,
				tinf: '',
			})
		)

		const piece2 = literal<PieceGeneric>({
			_id: protectString('piece2'),
			status: PieceStatusCode.UNKNOWN,
			name: 'Test_file_2',
			prerollDuration: 0,
			externalId: '',
			lifespan: PieceLifespan.WithinPart,
			metaData: {},
			outputLayerId: '',
			sourceLayerId: '',
			content: literal<VTContent>({
				fileName: 'test_file_2',
				path: '',
			}),
			timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		})

		const piece3 = literal<PieceGeneric>({
			_id: protectString('piece3'),
			status: PieceStatusCode.UNKNOWN,
			name: 'Test_file_3',
			prerollDuration: 0,
			externalId: '',
			lifespan: PieceLifespan.WithinPart,
			metaData: {},
			outputLayerId: '',
			sourceLayerId: '',
			content: literal<VTContent>({
				fileName: 'test_file_3',
				path: '',
			}),
			timelineObjectsString: EmptyPieceTimelineObjectsBlob,
		})

		const status1 = checkPieceContentStatus(piece1, sourcelayer1, mockStudio)
		expect(status1.status).toEqual(PieceStatusCode.OK)
		expect(status1.messages).toHaveLength(0)

		const status2 = checkPieceContentStatus(piece2, sourcelayer1, mockStudio)
		expect(status2.status).toEqual(PieceStatusCode.SOURCE_BROKEN)
		expect(status2.messages).toHaveLength(1)
		expect(status2.messages[0]).toMatchObject({
			key: '{{sourceLayer}} has the wrong format: {{format}}',
		})

		const status3 = checkPieceContentStatus(piece3, sourcelayer1, mockStudio)
		expect(status3.status).toEqual(PieceStatusCode.SOURCE_MISSING)
		expect(status3.messages).toHaveLength(1)
		expect(status3.messages[0]).toMatchObject({
			key: '{{sourceLayer}} is not yet ready on the playout system',
		})
	})
})

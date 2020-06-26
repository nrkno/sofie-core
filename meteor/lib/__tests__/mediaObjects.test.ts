import { Meteor } from 'meteor/meteor'
import { Random } from 'meteor/random'
import { Mongo } from 'meteor/mongo'
import { testInFiber } from '../../__mocks__/helpers/jest'
import {
	buildFormatString,
	acceptFormat,
	getAcceptedFormats,
	getMediaObjectMediaId,
	checkPieceContentStatus,
} from '../mediaObjects'
import {
	MediaObjects,
	MediaInfo,
	MediaObject,
	FieldOrder,
	MediaStream,
	Anomaly,
	MediaStreamType,
} from './../collections/MediaObjects'
import { literal, protectString } from '../lib'
import {
	ISourceLayer,
	SourceLayerType,
	IBlueprintPieceGeneric,
	PieceLifespan,
} from 'tv-automation-sofie-blueprints-integration'
import { IStudioSettings } from '../collections/Studios'
import { RundownAPI } from '../api/rundown'

describe('lib/mediaObjects', () => {
	testInFiber('buildFormatString', () => {
		const format1 = buildFormatString(
			literal<MediaInfo>({
				name: '',
				field_order: FieldOrder.TFF,
			}),
			literal<MediaStream>({
				width: 1920,
				height: 1080,
				codec: {
					time_base: '1/25',
				},
			})
		)
		expect(format1).toEqual('1920x1080i2500tff')

		const format2 = buildFormatString(
			literal<MediaInfo>({
				name: '',
				field_order: FieldOrder.Progressive,
			}),
			literal<MediaStream>({
				width: 1280,
				height: 720,
				codec: {
					time_base: '1001/60000',
				},
			})
		)
		expect(format2).toEqual('1280x720p5994')

		const format3 = buildFormatString(
			literal<MediaInfo>({
				name: '',
				field_order: FieldOrder.BFF,
			}),
			literal<MediaStream>({
				width: 720,
				height: 576,
				codec: {
					time_base: '1/25',
				},
			})
		)
		expect(format3).toEqual('720x576i2500bff')
	})

	testInFiber('acceptFormat', () => {
		const accepted1 = acceptFormat('1920x1080i2500tff', [['1920', '1080', 'i', '2500', 'tff']])
		expect(accepted1).toEqual(true)

		const accepted2 = acceptFormat('1920x1080i2500tff', [['1280', '720', 'p', '2500']])
		expect(accepted2).toEqual(false)
	})

	testInFiber('getAcceptedFormats', () => {
		const acceptedFormats = getAcceptedFormats({
			supportedMediaFormats: '1920x1080i5000, 1280x720, i5000, i5000tff',
			mediaPreviewsUrl: '',
			sofieUrl: '',
		})
		expect(acceptedFormats).toEqual([
			['1920', '1080', 'i', '5000', undefined],
			['1280', '720', undefined, undefined, undefined],
			[undefined, undefined, 'i', '5000', undefined],
			[undefined, undefined, 'i', '5000', 'tff'],
		])
	})

	testInFiber('getMediaObjectMediaId', () => {
		const mediaId1 = getMediaObjectMediaId(
			literal<IBlueprintPieceGeneric>({
				externalId: '',
				name: '',
				sourceLayerId: '',
				outputLayerId: '',
				content: {
					fileName: 'test',
				},
				lifespan: PieceLifespan.WithinPart,
			}),
			literal<ISourceLayer>({
				_id: '',
				_rank: 0,
				name: '',
				type: SourceLayerType.VT,
			})
		)
		expect(mediaId1).toEqual('TEST')

		const mediaId2 = getMediaObjectMediaId(
			literal<IBlueprintPieceGeneric>({
				externalId: '',
				name: '',
				sourceLayerId: '',
				outputLayerId: '',
				content: {
					fileName: 'TEST',
				},
				lifespan: PieceLifespan.WithinPart,
			}),
			literal<ISourceLayer>({
				_id: '',
				_rank: 0,
				name: '',
				type: SourceLayerType.SCRIPT,
			})
		)
		expect(mediaId2).toEqual(undefined)

		const mediaId3 = getMediaObjectMediaId(
			literal<IBlueprintPieceGeneric>({
				externalId: '',
				name: '',
				sourceLayerId: '',
				outputLayerId: '',
				content: {},
				lifespan: PieceLifespan.WithinPart,
			}),
			literal<ISourceLayer>({
				_id: '',
				_rank: 0,
				name: '',
				type: SourceLayerType.LIVE_SPEAK,
			})
		)
		expect(mediaId3).toEqual(undefined)
	})

	testInFiber('checkPieceContentStatus', () => {
		const mockStudioSettings: IStudioSettings = {
			supportedMediaFormats: '1920x1080i5000, 1280x720, i5000, i5000tff',
			mediaPreviewsUrl: '',
			supportedAudioStreams: '4',
			sofieUrl: '',
		}

		MediaObjects.insert(
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
					field_order: FieldOrder.TFF,
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

		const piece1 = literal<IBlueprintPieceGeneric>({
			name: 'Test_file',
			adlibPreroll: 0,
			externalId: '',
			lifespan: PieceLifespan.WithinPart,
			metaData: {},
			outputLayerId: '',
			sourceLayerId: '',
			content: {
				fileName: 'test_file',
			},
		})

		const sourcelayer1 = literal<ISourceLayer>({
			_id: '',
			_rank: 0,
			name: '',
			type: SourceLayerType.LIVE_SPEAK,
		})

		MediaObjects.insert(
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
					field_order: FieldOrder.Progressive,
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

		const piece2 = literal<IBlueprintPieceGeneric>({
			name: 'Test_file_2',
			adlibPreroll: 0,
			externalId: '',
			lifespan: PieceLifespan.WithinPart,
			metaData: {},
			outputLayerId: '',
			sourceLayerId: '',
			content: {
				fileName: 'test_file_2',
			},
		})

		const piece3 = literal<IBlueprintPieceGeneric>({
			name: 'Test_file_3',
			adlibPreroll: 0,
			externalId: '',
			lifespan: PieceLifespan.WithinPart,
			metaData: {},
			outputLayerId: '',
			sourceLayerId: '',
			content: {
				fileName: 'test_file_3',
			},
		})

		const status1 = checkPieceContentStatus(piece1, sourcelayer1, mockStudioSettings)
		expect(status1.status).toEqual(RundownAPI.PieceStatusCode.OK)
		expect(status1.message).toBeFalsy()

		const status2 = checkPieceContentStatus(piece2, sourcelayer1, mockStudioSettings)
		expect(status2.status).toEqual(RundownAPI.PieceStatusCode.SOURCE_BROKEN)
		expect(status2.message).toContain('is not in accepted formats')

		const status3 = checkPieceContentStatus(piece3, sourcelayer1, mockStudioSettings)
		expect(status3.status).toEqual(RundownAPI.PieceStatusCode.SOURCE_MISSING)
		expect(status3.message).toContain('is missing')
	})
})

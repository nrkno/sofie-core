import {
	buildFormatString,
	acceptFormat,
	getAcceptedFormats,
	getMediaObjectMediaId,
	PieceContentStreamInfo,
} from '../mediaObjects'
import { literal } from '../lib'
import {
	PackageInfo,
	WithTimeline,
	ISourceLayer,
	SourceLayerType,
	IBlueprintPieceGeneric,
	PieceLifespan,
	VTContent,
} from '@sofie-automation/blueprints-integration'

describe('lib/mediaObjects', () => {
	test('buildFormatString', () => {
		const format1 = buildFormatString(
			PackageInfo.FieldOrder.TFF,
			literal<PieceContentStreamInfo>({
				width: 1920,
				height: 1080,
				codec_time_base: '1/25',
			})
		)
		expect(format1).toEqual('1920x1080i2500tff')

		const format2 = buildFormatString(
			PackageInfo.FieldOrder.Progressive,

			literal<PieceContentStreamInfo>({
				width: 1280,
				height: 720,
				codec_time_base: '1001/60000',
			})
		)
		expect(format2).toEqual('1280x720p5994')

		const format3 = buildFormatString(
			PackageInfo.FieldOrder.BFF,
			literal<PieceContentStreamInfo>({
				width: 720,
				height: 576,
				codec_time_base: '1/25',
			})
		)
		expect(format3).toEqual('720x576i2500bff')
	})

	test('acceptFormat', () => {
		const accepted1 = acceptFormat('1920x1080i2500tff', [['1920', '1080', 'i', '2500', 'tff']])
		expect(accepted1).toEqual(true)

		const accepted2 = acceptFormat('1920x1080i2500tff', [['1280', '720', 'p', '2500']])
		expect(accepted2).toEqual(false)
	})

	test('getAcceptedFormats', () => {
		const acceptedFormats = getAcceptedFormats({
			supportedMediaFormats: '1920x1080i5000, 1280x720, i5000, i5000tff',
			mediaPreviewsUrl: '',
			frameRate: 25,
		})
		expect(acceptedFormats).toEqual([
			['1920', '1080', 'i', '5000', undefined],
			['1280', '720', undefined, undefined, undefined],
			[undefined, undefined, 'i', '5000', undefined],
			[undefined, undefined, 'i', '5000', 'tff'],
		])
	})

	test('getMediaObjectMediaId', () => {
		const mediaId1 = getMediaObjectMediaId(
			literal<IBlueprintPieceGeneric>({
				externalId: '',
				name: '',
				sourceLayerId: '',
				outputLayerId: '',
				content: literal<WithTimeline<VTContent>>({
					fileName: 'test',
					path: '',
					timelineObjects: [],
				}),
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
				content: literal<WithTimeline<VTContent>>({
					fileName: 'TEST',
					path: '',
					timelineObjects: [],
				}),
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
				content: {
					timelineObjects: [],
				},
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
})

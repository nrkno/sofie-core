import { DBSegmentLine } from '../../../lib/collections/SegmentLines'
import { TriggerType } from 'superfly-timeline'
import { RundownAPI } from '../../../lib/api/rundown'
import {
	SegmentLineItemOptional,
	TemplateFunctionOptional,
	TemplateResult,
} from './templates'
import { SourceLayers } from './nrk-layers'

const literal = <T>(o: T) => o

// @todo is this template wanted?
export const NrkBreakTemplate = literal<TemplateFunctionOptional>((context, story): TemplateResult => {
	let IDs = {
		lawo_automix: 		context.getHashId('lawo_automix'),
		lawo_effect: 		context.getHashId('lawo_effect'),
		headVideo: 			context.getHashId('headVideo'),
		atemSrv1: 			context.getHashId('atemSrv1'),
		wipeVideo: 			context.getHashId('wipeVideo'),
		wipeAudioSkille: 	context.getHashId('wipeAudioSkille'),
		wipeAudioPunktum: 	context.getHashId('wipeAudioPunktum'),
		headGfx: 			context.getHashId('headGfx'),
		playerClip: 		context.getHashId('playerClip')
	}
	  return {
		segmentLine: literal<DBSegmentLine>({
			_id: '',
			_rank: 0,
			mosId: '',
			segmentId: '',
			runningOrderId: '',
			slug: 'BREAK',
		}),
		segmentLineAdLibItems: null,
		segmentLineItems: [
			literal<SegmentLineItemOptional>({
				_id: '',
				mosId: '',
				segmentLineId: '',
				runningOrderId: '',
				name: 'BREAK',
				trigger: {
					type: TriggerType.TIME_ABSOLUTE,
					value: 'now'
				},
				status: RundownAPI.LineItemStatusCode.OK,
				sourceLayerId: SourceLayers.vignett,
				outputLayerId: 'pgm0',
				expectedDuration: 0,
				content: {
					timelineObjects: [
					]
				}
			})
			// literal<SegmentLineItemOptional>({
			// 	_id: '',
			// 	mosId: '',
			// 	segmentLineId: '',
			// 	runningOrderId: '',
			// 	name: 'AMB',
			// 	trigger: {
			// 		type: TriggerType.TIME_ABSOLUTE,
			// 		value: 0
			// 	},
			// 	status: RundownAPI.LineItemStatusCode.OK,
			// 	sourceLayerId: SourceLayers.vignett,
			// 	outputLayerId: 'pgm0',
			// 	expectedDuration: 100000,
			// 	content: {
			// 		fileName: 'AMB',
			// 		sourceDuration: 100000,
			// 		timelineObjects: [
			// 			literal<TimelineObjCCGVideo>({
			// 				_id: 'AMB', deviceId: [''],
			// 				siId: '',roId: '',
			// 				trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
			// 				priority: 1,
			// 				duration: 100000,
			// 				LLLayers.ayer: 'casparcg_player_vignett,
			// 				content: {
			// 					type: TimelineContentTypeCasparCg.VIDEO,
			// 					attributes: {
			// 						file: 'AMB',
			// 						loop: true
			// 					}
			// 				}
			// 			})
			// 		]
			// 	}
			// })
		]
	}
})


import * as _ from 'underscore'

import {
	IMOSConnectionStatus,
	IMOSDevice,
	IMOSListMachInfo,
	MosString128,
	MosTime,
	IMOSRunningOrder,
	IMOSRunningOrderBase,
	IMOSRunningOrderStatus,
	IMOSStoryStatus,
	IMOSItemStatus,
	IMOSStoryAction,
	IMOSROStory,
	IMOSROAction,
	IMOSItemAction,
	IMOSItem,
	IMOSROReadyToAir,
	IMOSROFullStory,
	IMOSStory,
	IMOSExternalMetaData,
	IMOSROFullStoryBodyItem
} from 'mos-connection'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { SegmentLine, SegmentLines, DBSegmentLine } from '../../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems, ITimelineTrigger } from '../../../lib/collections/SegmentLineItems'
import { TriggerType } from 'superfly-timeline'
import { RundownAPI } from '../../../lib/api/rundown'
import { IOutputLayer,
	ISourceLayer
} from '../../../lib/collections/StudioInstallations'
import {
	TemplateFunction,
	TemplateSet,
	SegmentLineItemOptional,
	TemplateFunctionOptional,
	TemplateResult,
	TemplateContextInner,
	StoryWithContext
} from './templates'
import {
	TimelineObjCCGVideo,
	TimelineObjLawoSource,
	TimelineObjCCGHTMLPage,
	TimelineObjCCGTemplate,
	TimelineContentTypeCasparCg,
	TimelineContentTypeLawo,
	TimelineContentTypeAtem,
	TimelineObj,
	TimelineObjAbstract,
	Atem_Enums,
	TimelineObjAtemME,
	TimelineObjAtemAUX,
	TimelineObjAtemDSK,
	TimelineObjAtemSsrc
} from '../../../lib/collections/Timeline'
import { Transition, Ease, Direction } from '../../../lib/constants/casparcg'
import { Optional } from '../../../lib/lib'
import { SegmentLineAdLibItems } from '../../../lib/collections/SegmentLineAdLibItems'

import { LLayers, SourceLayers } from './nrk-layers'
import { AtemSource } from './nrk-constants'

const literal = <T>(o: T) => o

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

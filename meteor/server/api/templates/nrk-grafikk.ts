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
	TimelineObjAtemSsrc,
	SuperSourceBox
} from '../../../lib/collections/Timeline'
import { Transition, Ease, Direction } from '../../../lib/constants/casparcg'
import { Optional } from '../../../lib/lib'

import { LLayers, SourceLayers } from './nrk-layers'
import { RMFirstInput, KamFirstInput, AtemSource } from './nrk-inputs'
import { isNumber } from 'util'

const literal = <T>(o: T) => o

function parseInputNumber (str: string): number | undefined {
	str = (str || '').toLowerCase()

	const ind = parseInt(str.replace(/\D/g,''), 10) || 1
	if (str.indexOf('k') === 0) {
		return KamFirstInput + ind - 1
	}
	if (str.indexOf('r') === 0) {
		return RMFirstInput + ind - 1
	}

	return undefined
}

function inputToLawoSource (inp: number): string | undefined {
	switch (inp) {
		case RMFirstInput:
			return LLayers.lawo_source_rm1
		case RMFirstInput + 1:
			return LLayers.lawo_source_rm2
		case RMFirstInput + 2:
			return LLayers.lawo_source_rm3
	}

	return undefined
}

function isAutomixAudio (inp: number): boolean {
	return (inp >= KamFirstInput && inp < RMFirstInput)
}

export const NrkGrafikkTemplate = literal<TemplateFunctionOptional>((context: TemplateContextInner, story): TemplateResult => {
	let IDs = {
		atemSrv1: 			context.getHashId('atemSrv1'),
		lawo_automix:       context.getHashId('lawo_automix'),
	}

	// @todo parse grafikk type
	let mosartVariant = story.getValueByPath('MosExternalMetaData.0.MosPayload.mosartVariant', '') + ''
	context.warning('Unknown variant: ' + mosartVariant)

	let segmentLineItems: Array<SegmentLineItemOptional> = []
	segmentLineItems.push(literal<SegmentLineItemOptional>({
		_id: '',
		mosId: '',
		segmentLineId: '',
		runningOrderId: '',
		name: 'GRAFIKK',
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 0
		},
		status: RundownAPI.LineItemStatusCode.UNKNOWN,
		sourceLayerId: SourceLayers.graphics0,
		outputLayerId: 'pgm0',
		expectedDuration: ( // @todo rewrite this
			story.getValueByPath('MosExternalMetaData.0.MosPayload.Actual') ||
			story.getValueByPath('MosExternalMetaData.0.MosPayload.Estimated') ||
			0
		) * 1000,
		content: {
			timelineObjects: _.compact([
				// @todo run template. might need to preroll template a few frames

				literal<TimelineObjAtemME>({
					_id: IDs.atemSrv1, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
					priority: 1,
					duration: 0,
					LLayer: LLayers.atem_me_program,
					content: {
						type: TimelineContentTypeAtem.ME,
						attributes: {
							input: AtemSource.Grafikk,
							transition: Atem_Enums.TransitionStyle.CUT
						}
					}
				}),

				// automix mic hot
				literal<TimelineObjLawoSource>({
					_id: IDs.lawo_automix, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
					priority: 1,
					duration: 0,
					LLayer: LLayers.lawo_source_automix,
					content: {
						type: TimelineContentTypeLawo.AUDIO_SOURCE,
						transitions: {
							inTransition: {
								type: Transition.MIX,
								duration: 200,
								easing: Ease.LINEAR,
								direction: Direction.LEFT
							}
						},
						attributes: {
							db: 0
						}
					}
				}),
			])
		}
	}))

	return {
		segmentLine: literal<DBSegmentLine>({
			_id: '',
			_rank: 0,
			mosId: '',
			segmentId: '',
			runningOrderId: '',
			slug: 'GRAFIKK',
		}),
		segmentLineItems: segmentLineItems,
		segmentLineAdLibItems: null
	}
})

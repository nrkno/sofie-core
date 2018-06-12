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
	SuperSourceBox,
	TimelineObjHTTPPost,
	TimelineContentTypeHttp
} from '../../../lib/collections/Timeline'
import { Transition, Ease, Direction } from '../../../lib/constants/casparcg'
import { Optional } from '../../../lib/lib'

import { LLayers, SourceLayers } from './nrk-layers'
import { RMFirstInput, KamFirstInput, AtemSource, LawoFadeInDuration, CasparOutputDelay } from './nrk-constants'
import { isNumber } from 'util'

import { ParseGraffikData } from './nrk-grafikk'

const literal = <T>(o: T) => o

function inputToLawoSource (str: string): string | undefined {
	str = (str || '').toLowerCase()

	const ind = parseInt(str.replace(/\D/g,''), 10) || 1
	switch (ind) {
		case 1:
			return LLayers.lawo_source_tlf1
		case 2:
			return LLayers.lawo_source_tlf2
	}

	return undefined
}

export const NrkTLFTemplate = literal<TemplateFunctionOptional>((context: TemplateContextInner, story): TemplateResult => {
	let IDs = {
		atemSrv1: 			context.getHashId('atemSrv1'),
		lawo_automix:       context.getHashId('lawo_automix'),
		lawo_tlf:           context.getHashId('lawo_tlf'),
		gfxPost:			context.getHashId('gfxPost'),
	}

	let tlfSource = inputToLawoSource(story.getValueByPath('MosExternalMetaData.0.MosPayload.tlf', '') + '')
	if (!tlfSource) {
		context.warning('tlf source missing')
	}

	const noraGroup = process.env.MESOS_NORA_GROUP || 'dksl' // @todo config not env
	const gfxPayload = ParseGraffikData(context, story)

	let segmentLineItems: Array<SegmentLineItemOptional> = []
	segmentLineItems.push(literal<SegmentLineItemOptional>({
		_id: '',
		mosId: '',
		segmentLineId: '',
		runningOrderId: '',
		name: 'TLF',
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
				(gfxPayload ?
				literal<TimelineObjHTTPPost>({
					_id: IDs.gfxPost, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
					priority: 1,
					duration: 0,
					LLayer: LLayers.casparcg_cg_graphics_ctrl, // @todo - this should be a seperate layer to ensure the right animations are run
					content: {
						type: TimelineContentTypeHttp.POST,
						url: 'http://nora.core.mesosint.nrk.no/api/v1/renders/' + noraGroup + '/' + gfxPayload.channel + '?apiKey=' + process.env.MESOS_API_KEY,
						params: gfxPayload.payload
					}
				}) : undefined),

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
								duration: LawoFadeInDuration,
								easing: Ease.LINEAR,
								direction: Direction.LEFT
							}
						},
						attributes: {
							db: 0
						}
					}
				}),

				(tlfSource ?
				literal<TimelineObjLawoSource>({
					_id: IDs.lawo_tlf, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
					priority: 1,
					duration: 0,
					LLayer: tlfSource,
					content: {
						type: TimelineContentTypeLawo.AUDIO_SOURCE,
						transitions: {
							inTransition: {
								type: Transition.MIX,
								duration: LawoFadeInDuration,
								easing: Ease.LINEAR,
								direction: Direction.LEFT
							}
						},
						attributes: {
							db: 0
						}
					}
				}) : undefined),

				// preroll gfx a couple of frames before cutting to it
				literal<TimelineObjAtemME>({
					_id: IDs.atemSrv1, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + ${CasparOutputDelay} + 80` },
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
			slug: 'TLF',
		}),
		segmentLineItems: segmentLineItems,
		segmentLineAdLibItems: null
	}
})

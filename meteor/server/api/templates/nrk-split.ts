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

export const NrkSplitTemplate = literal<TemplateFunctionOptional>((context: TemplateContextInner, story): TemplateResult => {
	let left = parseInputNumber(story.getValueByPath('MosExternalMetaData.0.MosPayload.ip1', '') + '')
	let right = parseInputNumber(story.getValueByPath('MosExternalMetaData.0.MosPayload.ip2', '') + '')

	if (!left) {
		context.warning('ip1 for 2LIKE should be the kam/rm to use')
		left = Atem_Enums.SourceIndex.Bars
	}
	if (!right) {
		context.warning('ip2 for 2LIKE should be the kam/rm to use')
		right = Atem_Enums.SourceIndex.Bars
	}

	let IDs = {
		atemSrv1: 			context.getHashId('atemSrv1'),
		atemSSrc:			context.getHashId('atemSSrc'),
		lawo_effect:        context.getHashId('lawo_effect'),
		lawo_automix:       context.getHashId('lawo_automix'),
		lawo_layer1:        context.getHashId('lawo_layer1'),
		lawo_layer2:        context.getHashId('lawo_layer2'),
	}

	const lawoLayer1 = inputToLawoSource(left)
	const lawoLayer2 = inputToLawoSource(right)
	const lawoHost = isAutomixAudio(left) || isAutomixAudio(right)

	let segmentLineItems: Array<SegmentLineItemOptional> = []
	segmentLineItems.push(literal<SegmentLineItemOptional>({
		_id: '',
		mosId: '',
		segmentLineId: '',
		runningOrderId: '',
		name: 'SPLIT',
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 0
		},
		status: RundownAPI.LineItemStatusCode.UNKNOWN,
		sourceLayerId: SourceLayers.camera0,
		outputLayerId: 'pgm0',
		expectedDuration: ( // @todo rewrite this
			story.getValueByPath('MosExternalMetaData.0.MosPayload.Actual') ||
			story.getValueByPath('MosExternalMetaData.0.MosPayload.Estimated') ||
			0
		) * 1000,
		content: {
			timelineObjects: _.compact([
				literal<TimelineObjAtemME>({
					_id: IDs.atemSrv1, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
					priority: 1,
					duration: 0,
					LLayer: LLayers.atem_me_program,
					content: {
						type: TimelineContentTypeAtem.ME,
						attributes: {
							input: Atem_Enums.SourceIndex.SSrc,
							transition: Atem_Enums.TransitionStyle.CUT
						}
					}
				}),

				// automix mic hot
				(lawoHost ?
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
					}) : undefined),

				// mic1 hot
				(lawoLayer1 ?
				literal<TimelineObjLawoSource>({
					_id: IDs.lawo_layer1, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
					priority: 1,
					duration: 0,
					LLayer: lawoLayer1,
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
							db: -15
						}
					}
				}) : undefined),

				// mic2 hot
				(lawoLayer2 ?
				literal<TimelineObjLawoSource>({
					_id: IDs.lawo_layer2, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
					priority: 1,
					duration: 0,
					LLayer: lawoLayer2,
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
							db: -15
						}
					}
				}) : undefined),

				literal<TimelineObjAtemSsrc>({
					_id: IDs.atemSSrc, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
					priority: 1,
					duration: 0,
					LLayer: LLayers.atem_supersource,
					content: {
						type: TimelineContentTypeAtem.SSRC,
						attributes: {
							boxes: [
								literal<SuperSourceBox>({ // left
									enabled: true,
									source: left,
								}),
								literal<SuperSourceBox>({ // right
									enabled: true,
									source: right,
								}),
								literal<SuperSourceBox>({ // background
									enabled: true,
								}),
							],
							// artfillSource: AtemSource.SSrcArtFill,
						}
					}
				}),
			])
		}
	}))

	// @todo parse graphics

	return {
		segmentLine: literal<DBSegmentLine>({
			_id: '',
			_rank: 0,
			mosId: '',
			segmentId: '',
			runningOrderId: '',
			slug: 'DIR',
		}),
		segmentLineItems: segmentLineItems,
		segmentLineAdLibItems: null
	}
})

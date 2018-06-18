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
	TimelineObjLawo,
	TimelineObjCCGTemplate,
	TimelineContentTypeCasparCg,
	TimelineContentTypeLawo,
	TimelineContentTypeAtem,
	TimelineObj,
	TimelineObjAbstract,
	Atem_Enums,
	TimelineObjAtemME,
	EmberPlusValueType,
	TimelineObjAtemAUX,
	TimelineObjAtemDSK,
	TimelineObjAtemSsrc,
	SuperSourceBox
} from '../../../lib/collections/Timeline'
import { Transition, Ease, Direction } from '../../../lib/constants/casparcg'
import { Optional } from '../../../lib/lib'

import { LLayers, SourceLayers } from './nrk-layers'
import { RMFirstInput, KamFirstInput, AtemSource, LawoFadeInDuration, CasparOutputDelay } from './nrk-constants'
import { isNumber } from 'util'

const literal = <T>(o: T) => o

export const NrkSTKTemplate = literal<TemplateFunctionOptional>((context: TemplateContextInner, story): TemplateResult => {
	let IDs = {
		atemSrv1: 			context.getHashId('atemSrv1'),
		playerClip:			context.getHashId('playerClip'),
		lawo_automix:       context.getHashId('lawo_automix'),
		lawo_clip:			context.getHashId('lawo_clip'),
	}

	let clipLevel = -15
	const mosartVariant = story.getValueByPath('MosExternalMetaData.0.MosPayload.mosartVariant', '') + ''
	if (mosartVariant && mosartVariant.match(/ulyd/i)) {
		clipLevel = -191 // -inf
	} else {
		context.warning('Unknown variant: ' + mosartVariant)
	}

	let storyItemClip = _.find(story.Body, (item) => {
		return (
			item.Type === 'storyItem' &&
			context.getValueByPath(item, 'Content.mosExternalMetadata.mosPayload.objectType')
				=== 'CLIP'
		)
	})
	if (!storyItemClip) context.warning('Clip missing in mos data')

	let clip = context.getValueByPath(storyItemClip, 'Content.objSlug', 'head')
	if (!clip || clip === '') context.warning('Clip slug missing in mos data')
	let name = (
		context.getValueByPath(storyItemClip, 'Content.objSlug', '') ||
		context.getValueByPath(storyItemClip, 'Content.mosExternalMetadata.mosPayload.title', '') ||
		clip
	)
	if (!name || name === '') context.warning('Clip name missing in mos data')

	let segmentLineItems: Array<SegmentLineItemOptional> = []
	segmentLineItems.push(literal<SegmentLineItemOptional>({
		_id: '',
		mosId: '',
		segmentLineId: '',
		runningOrderId: '',
		name: name,
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 0
		},
		status: RundownAPI.LineItemStatusCode.UNKNOWN,
		sourceLayerId: SourceLayers.live_speak0,
		outputLayerId: 'pgm0',
		expectedDuration: ( // @todo rewrite this
			story.getValueByPath('MosExternalMetaData.0.MosPayload.Actual') ||
			story.getValueByPath('MosExternalMetaData.0.MosPayload.Readtime') ||
			story.getValueByPath('MosExternalMetaData.0.MosPayload.Estimated') ||
			0
		) * 1000,
		content: {
			timelineObjects: _.compact([
				// play STK
				literal<TimelineObjCCGVideo>({
					_id: IDs.playerClip, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
					priority: 1,
					duration: 0, // hold at end
					LLayer: LLayers.casparcg_player_clip,
					content: {
						type: TimelineContentTypeCasparCg.VIDEO,
						attributes: {
							file: 'mam/' + clip
						}
					}
				}),

				literal<TimelineObjAtemME>({
					_id: IDs.atemSrv1, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.playerClip}.start + ${CasparOutputDelay}` },
					priority: 1,
					duration: 0,
					LLayer: LLayers.atem_me_program,
					content: {
						type: TimelineContentTypeAtem.ME,
						attributes: {
							input: AtemSource.Server1,
							transition: Atem_Enums.TransitionStyle.CUT
						}
					}
				}),

				// server1 to -15db/-inf
				literal<TimelineObjLawo>({
					_id: IDs.lawo_clip, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.playerClip}.start + ${CasparOutputDelay}` },
					priority: 1,
					duration: 0,
					LLayer: LLayers.lawo_source_clip,
					content: {
						type: TimelineContentTypeLawo.LAWO,
						value: {
							value: {
								value: clipLevel,
								type: EmberPlusValueType.REAL
							},
							transitionDuration: LawoFadeInDuration,
						}
					}
				}),

				// automix mic hot
				literal<TimelineObjLawo>({
					_id: IDs.lawo_automix, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.playerClip}.start + ${CasparOutputDelay}` },
					priority: 1,
					duration: 0,
					LLayer: LLayers.lawo_source_automix,
					content: {
						type: TimelineContentTypeLawo.LAWO,
						value: {
							value: {
								value: 0,
								type: EmberPlusValueType.REAL
							},
							transitionDuration: LawoFadeInDuration,
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
			slug: 'STK',
			overlapDuration: CasparOutputDelay,
		}),
		segmentLineItems: segmentLineItems,
		segmentLineAdLibItems: null
	}
})

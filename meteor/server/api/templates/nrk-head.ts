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
	SegmentLineAdLibItemOptional,
	TemplateFunctionOptional,
	TemplateResult,
	TemplateContextInner,
	StoryWithContext
} from './templates'
import {
	TimelineObjCCGVideo,
	TimelineObjLawoSource,
	TimelineObjCCGTemplate,
	TimelineContentTypeOther,
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
	TimelineObjHTTPPost,
	TimelineContentTypeHttp
} from '../../../lib/collections/Timeline'
import { Transition, Ease, Direction } from '../../../lib/constants/casparcg'
import { Optional } from '../../../lib/lib'
import { SegmentLineAdLibItems } from '../../../lib/collections/SegmentLineAdLibItems'

import { LLayers, NoraChannels, SourceLayers } from './nrk-layers'
import { AtemSource } from './nrk-inputs'
import { ParseSuperSegments } from './nrk-graphics'

const literal = <T>(o: T) => o

export const NrkHeadTemplate = literal<TemplateFunctionOptional>(function (context, story) {
	let IDs = {
		lawo_automix: 		context.getHashId('lawo_automix'),
		lawo_effect: 		context.getHashId('lawo_effect'),
		lawo_clip: 		    context.getHashId('lawo_clip'),
		headVideo: 			context.getHashId('headVideo'),
		atemSrv1: 			context.getHashId('atemSrv1'),
		wipeVideo: 			context.getHashId('wipeVideo'),
		wipeAudioSkille: 	context.getHashId('wipeAudioSkille'),
		headGfx: 			context.getHashId('headGfx'),
		playerClip: 		context.getHashId('playerClip'),
		playerClipTransition: context.getHashId('playerClipTransition'),
		vignett: context.getHashId('vignett'),
	}

	const segmentLines = context.getSegmentLines()
	const segmentPos = context.getSegmentLineIndex()

	// @todo this number assumes a certain flow
	const isFirstHeadAfterVignett = segmentPos === 1
	// const isLastHead = segmentPos == segmentLines.length - 2

	let storyItemClip = _.find(story.Body, (item) => {
		return (
			item.Type === 'storyItem' &&
			context.getValueByPath(item, 'Content.mosExternalMetadata.mosPayload.objectType')
				=== 'CLIP'
		)
	})
	if (!storyItemClip) context.warning('Clip missing in mos data')

	let clip = context.getValueByPath(storyItemClip, 'Content.mosExternalMetadata.mosPayload.title', 'head')
	if (!clip || clip === '') context.warning('Clip name missing in mos data')

	// Copy the vignett from the previous segmentLine if it was found.
	// @todo make this more durable and refactor to reusable.
	// @todo look into if this can be automated more. eg if content is null that means persist from before if found
	let prevContent = (segmentLines[0].getSegmentLinesItems()[0] || {}).content
	let vignetObj: TimelineObjCCGVideo | null | undefined
	if (prevContent && prevContent.timelineObjects) {
		vignetObj = prevContent.timelineObjects.find((o: TimelineObj) => o.LLayer === LLayers.casparcg_player_vignett) as TimelineObjCCGVideo
		if (vignetObj) {
			vignetObj = literal<TimelineObjCCGVideo>({
				_id: IDs.vignett, deviceId: [''], siId: '', roId: '',
				trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
				priority: 1,
				duration: vignetObj.duration,
				LLayer: LLayers.casparcg_player_vignett,
				content: vignetObj.content
			})
		}
	}

	let segmentLineItems: Array<SegmentLineItemOptional> = []
	let transiton: SegmentLineItemOptional = {
		_id: context.getHashId('transition'),
		mosId: 'transition',
		name: 'transition',
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 0
		},
		status: RundownAPI.LineItemStatusCode.UNKNOWN,
		sourceLayerId: SourceLayers.live_transition0,
		outputLayerId: 'pgm0',
		expectedDuration: 3600, // transform into milliseconds
		isTransition: true,
		content: {
			fileName: clip,
			sourceDuration: (
				context.getValueByPath(storyItemClip, 'Content.objDur', 0) /
				(context.getValueByPath(storyItemClip, 'Content.objTB') || 1)
			) * 1000,

			timelineObjects: _.compact([
				// wipe to head (if not first head after vignett)
				literal<TimelineObjCCGVideo>({
					_id: IDs.wipeVideo, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + 0` },
					priority: 1,
					duration: 3360,
					LLayer: LLayers.casparcg_player_wipe,
					content: {
						type: TimelineContentTypeCasparCg.VIDEO,
						attributes: {
							file: 'assets/wipe1'
						}
					}
				}),

				// wipe audio skille between
				// @todo lower the level of this wipe in ccg
				literal<TimelineObjCCGVideo>({
					_id: IDs.wipeAudioSkille, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + 0` },
					priority: 1,
					duration: 3360,
					LLayer: LLayers.casparcg_player_soundeffect,
					content: {
						type: TimelineContentTypeCasparCg.VIDEO,
						attributes: {
							file: 'assets/DK_skille_head'
						}
					}
				}),

				// play HEAD
				// @todo refactor to make this block less duplicated
				literal<TimelineObjCCGVideo>({
					_id: IDs.playerClipTransition, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + 0` },
					priority: 2,
					duration: (
						context.getValueByPath(storyItemClip, 'Content.objDur', 0) /
						(context.getValueByPath(storyItemClip, 'Content.objTB') || 1)
					) * 1000,
					LLayer: LLayers.casparcg_player_clip,
					content: {
						type: TimelineContentTypeCasparCg.VIDEO,
						transitions: {
							inTransition: {
								type: Transition.MIX,
								duration: 200,
								easing: Ease.LINEAR,
								direction: Direction.LEFT
							}
						},
						attributes: {
							file: 'mam/' + clip
							// @todo seek?
						}
					}
				})
			])
		},
	}
	let video: SegmentLineItemOptional = {
		_id: context.getHashId('video'),
		mosId: 'headvideo',
		name: clip,
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 0
		},
		status: RundownAPI.LineItemStatusCode.UNKNOWN,
		sourceLayerId: SourceLayers.live_speak0,
		outputLayerId: 'pgm0',
		expectedDuration: ( // @todo rewrite this blob
			story.getValueByPath('MosExternalMetaData.0.MosPayload.Estimated') ||
			context.sumMosItemDurations(story.getValueByPath('MosExternalMetaData.0.MosPayload.MOSItemDurations')) ||
			story.getValueByPath('MosExternalMetaData.0.MosPayload.MediaTime') ||
			story.getValueByPath('MosExternalMetaData.0.MosPayload.SourceMediaTime') ||
			10
		) * 1000, // transform into milliseconds
		isTransition: false,
		content: {
			fileName: clip,
			sourceDuration: (
				context.getValueByPath(storyItemClip, 'Content.objDur', 0) /
				(context.getValueByPath(storyItemClip, 'Content.objTB') || 1)
			) * 1000,

			timelineObjects: _.compact([
				// try and keep vignett running
				// @todo. should this be a seperate segmentlineitem to make it clear it continues to the user?
				vignetObj,

				literal<TimelineObjLawoSource>({
					_id: IDs.lawo_effect, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
					priority: 1,
					duration: 0,
					LLayer: LLayers.lawo_source_effect,
					content: {
						type: TimelineContentTypeLawo.AUDIO_SOURCE,
						attributes: {
							db: 0
						}
					}
				}),

				// mic host hot
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

				// audio STK/HEADS -15dB
				// @todo should this be -inf?
				literal<TimelineObjLawoSource>({
					_id: IDs.lawo_clip, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + 0` },
					priority: 1,
					duration: 0,
					LLayer: LLayers.lawo_source_clip,
					content: {
						type: TimelineContentTypeLawo.AUDIO_SOURCE,
						transitions: {
							inTransition: { // @todo should this have a transition?
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
				}),

				// switch to server1
				literal<TimelineObjAtemME>({
					_id: IDs.atemSrv1, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + 0` },
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

				// play HEAD
				literal<TimelineObjCCGVideo>({
					_id: IDs.playerClip, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + 0` },
					priority: 1,
					duration: (
						context.getValueByPath(storyItemClip, 'Content.objDur', 0) /
						(context.getValueByPath(storyItemClip, 'Content.objTB') || 1)
					) * 1000,
					LLayer: LLayers.casparcg_player_clip,
					content: {
						type: TimelineContentTypeCasparCg.VIDEO,
						attributes: {
							file: 'mam/' + clip
						}
					}
				})
			])
		}
	}
	segmentLineItems.push(transiton)
	segmentLineItems.push(video)

	let segmentLineAdLibItems: Array<SegmentLineAdLibItemOptional> = []
	ParseSuperSegments(context, story, segmentLineItems, segmentLineAdLibItems, video._id || '')

	return literal<TemplateResult>({
		segmentLine: literal<DBSegmentLine>({
			_id: '',
			_rank: 0,
			mosId: '',
			segmentId: '',
			runningOrderId: '',
			slug: context.segmentLine._id,
			autoNext: isFirstHeadAfterVignett,
			overlapDuration: 160,
		}),
		segmentLineItems: segmentLineItems,
		segmentLineAdLibItems: segmentLineAdLibItems
	})
})

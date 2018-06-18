
import * as _ from 'underscore'

import { TriggerType } from 'superfly-timeline'
import { RundownAPI } from '../../../lib/api/rundown'
import {
	SegmentLineItemOptional,
	SegmentLineAdLibItemOptional,
	TemplateFunctionOptional,
	TemplateResult,
} from './templates'
import {
	TimelineObjCCGVideo,
	TimelineContentTypeCasparCg,
	TimelineContentTypeLawo,
	TimelineContentTypeAtem,
	Atem_Enums,
	TimelineObjAtemME,
	EmberPlusValueType,
	TimelineObjLawo,
} from '../../../lib/collections/Timeline'
import { Transition, Ease, Direction } from '../../../lib/constants/casparcg'
import { LLayers, SourceLayers } from './nrk-layers'
import { AtemSource, LawoFadeInDuration, CasparOutputDelay } from './nrk-constants'
import { ParseSuperSegments } from './nrk-graphics'
import { DBSegmentLine } from '../../../lib/collections/SegmentLines'

const literal = <T>(o: T) => o

// @todo is this essentially just another variant of stk?
export const NrkFullTemplate = literal<TemplateFunctionOptional>(function (context, story) {
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

	let storyItemClip = _.find(story.Body, (item) => {
		return (
			item.Type === 'storyItem' &&
			context.getValueByPath(item, 'Content.mosExternalMetadata.mosPayload.objectType')
				=== 'CLIP'
		)
	})
	if (!storyItemClip) context.warning('Clip missing in mos data')

	let clip = context.getValueByPath(storyItemClip, 'Content.objSlug', 'full')
	if (!clip || clip === '') context.warning('Clip slug missing in mos data')
	let name = context.getValueByPath(storyItemClip, 'Content.mosExternalMetadata.mosPayload.title', clip)
	if (!name || name === '') context.warning('Clip name missing in mos data')

	let segmentLineItems: Array<SegmentLineItemOptional> = []
	let video: SegmentLineItemOptional = {
		_id: context.getHashId('video'),
		mosId: 'fullvideo',
		name: name,
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 0
		},
		status: RundownAPI.LineItemStatusCode.UNKNOWN,
		sourceLayerId: SourceLayers.vb,
		outputLayerId: 'pgm0',
		expectedDuration: ( // @todo rewrite this blob
			story.getValueByPath('MosExternalMetaData.0.MosPayload.Estimated') ||
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
				// play FULL
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

				// mic host muted
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
								value: -191,
								type: EmberPlusValueType.REAL
							},
							transitionDuration: LawoFadeInDuration,
						}
					}
				}),

				// audio FULL 0
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
								value: 0,
								type: EmberPlusValueType.REAL
							},
							transitionDuration: LawoFadeInDuration,
						}
					}
				}),

				// switch to server1
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

			])
		}
	}
	// segmentLineItems.push(transiton)
	segmentLineItems.push(video)

	let segmentLineAdLibItems: Array<SegmentLineAdLibItemOptional> = []
	ParseSuperSegments(context, story, segmentLineItems, segmentLineAdLibItems, video._id || '', IDs.playerClip)

	return literal<TemplateResult>({
		segmentLine: literal<DBSegmentLine>({
			_id: '',
			_rank: 0,
			mosId: '',
			segmentId: '',
			runningOrderId: '',
			slug: context.segmentLine._id,
			autoNext: true,
			overlapDuration: CasparOutputDelay,
		}),
		segmentLineItems: segmentLineItems,
		segmentLineAdLibItems: segmentLineAdLibItems
	})
})

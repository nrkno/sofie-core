
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
	TimelineObjAtemSsrc
} from '../../../lib/collections/Timeline'
import { Transition, Ease, Direction } from '../../../lib/constants/casparcg'
import { Optional } from '../../../lib/lib'

import { LLayers, SourceLayers } from './nrk-layers'
import { KamFirstInput, LawoFadeInDuration, AtemWipeSettings } from './nrk-constants'
import { isNumber } from 'util'

const literal = <T>(o: T) => o

export const NrkKamTemplate = literal<TemplateFunctionOptional>((context: TemplateContextInner, story): TemplateResult => {
	let cameraInput = 0
	let mosartVariant = story.getValueByPath('MosExternalMetaData.0.MosPayload.mosartVariant', '') + ''
	if (mosartVariant) {
		// mosartVariant can be something like ÅPNING3, so strip anything non numeric
		cameraInput = parseInt(mosartVariant.replace(/\D/g,''), 10) || 0
	} else {
		context.warning('mosartVariant for KAM should be the camera to cut to')
	}

	let IDs = {
		atemSrv1: 			context.getHashId('atemSrv1'),
		atemSrv1Transition:	context.getHashId('atemSrv1Transition'),
		wipeVideo: 			context.getHashId('wipeVideo'),
		wipeAudioPunktum:   context.getHashId('wipeAudioPunktum'),
		vignettTransition:  context.getHashId('vignettTransition'),
		vignettVideo:		context.getHashId('vignettVideo'),
		lawo_effect:        context.getHashId('lawo_effect'),
		lawo_automix:       context.getHashId('lawo_automix'),
		lawo_automix_out:   context.getHashId('lawo_automix_out'),
	}

	let overlapDuration: number | undefined

	// @todo try and move this to be run at the end of other templates, as it really is just an out animation for them
	let segmentLineItems: Array<SegmentLineItemOptional> = []

	// if previous SegmentLine is head, then wipe out of it
	const segmentLines = context.getSegmentLines()
	const segmentPos = context.getSegmentLineIndex()
	if (mosartVariant.match(/SLUTT/i)) { // @todo check another field. slug?
		segmentLineItems.push(literal<SegmentLineItemOptional>({
			_id: '',
			mosId: '',
			segmentLineId: '',
			runningOrderId: '',
			name: 'sluttvignett',
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: 0
			},
			status: RundownAPI.LineItemStatusCode.UNKNOWN,
			sourceLayerId: SourceLayers.graphics0,
			outputLayerId: 'pgm0',
			expectedDuration: 15 * 1000,
			content: {
				timelineObjects: _.compact([
					// utvignett to 0db
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

					// @todo graphics template (on gfx1?)

					// play utvignett
					literal<TimelineObjCCGVideo>({
						_id: IDs.vignettVideo, deviceId: [''], siId: '', roId: '',
						trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_effect}.start + 0` }, // @todo offset to after gfx
						priority: 1,
						duration: 0, // hold at end
						LLayer: LLayers.casparcg_player_vignett, // @todo same channel as gfx1
						content: {
							type: TimelineContentTypeCasparCg.VIDEO,
							attributes: {
								file: 'assets/sluttvignett'
							}
						}
					}),

					// fade out host mic
					literal<TimelineObjLawoSource>({
						_id: IDs.lawo_automix_out, deviceId: [''], siId: '', roId: '',
						trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.vignettVideo}.start + 0` },
						priority: 5,
						duration: 0,
						LLayer: LLayers.lawo_source_effect,
						content: {
							type: TimelineContentTypeLawo.AUDIO_SOURCE,
							transitions: {
								inTransition: {
									type: Transition.MIX,
									duration: 1400,
									easing: Ease.LINEAR,
									direction: Direction.LEFT
								}
							},
							attributes: {
								db: -191 // -inf
							}
						}
					}),

				]),
			}
		}))
	} else if (segmentPos > 0 && (segmentLines[segmentPos - 1].slug.match(/;head/i) || segmentLines[segmentPos - 1].slug.match(/ÅPNING/i))) {
		segmentLineItems.push(literal<SegmentLineItemOptional>({
			_id: '',
			mosId: '',
			segmentLineId: '',
			runningOrderId: '',
			name: 'Transition',
			trigger: {
				type: TriggerType.TIME_ABSOLUTE,
				value: 0
			},
			status: RundownAPI.LineItemStatusCode.UNKNOWN,
			sourceLayerId: SourceLayers.live_transition0,
			outputLayerId: 'pgm0',
			expectedDuration: ( // @todo rewrite this
				story.getValueByPath('MosExternalMetaData.0.MosPayload.Actual') ||
				story.getValueByPath('MosExternalMetaData.0.MosPayload.Estimated') ||
				0
			) * 1000,
			content: {
				timelineObjects: _.compact([

					literal<TimelineObjCCGVideo>({
						_id: IDs.wipeVideo, deviceId: [''], siId: '', roId: '',
						trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
						priority: 1,
						duration: 3640,
						LLayer: LLayers.casparcg_player_wipe,
						content: {
							type: TimelineContentTypeCasparCg.VIDEO,
							attributes: {
								file: 'assets/wipe1'
							}
						}
					}),

					// wipe audio punktum
					literal<TimelineObjCCGVideo>({
						_id: IDs.wipeAudioPunktum, deviceId: [''], siId: '', roId: '',
						trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.wipeVideo}.start + 0` },
						priority: 1,
						duration: 3640,
						LLayer: LLayers.casparcg_player_soundeffect,
						content: {
							type: TimelineContentTypeCasparCg.VIDEO,
							attributes: {
								file: 'assets/DK_punktum_head'
							},
							mixer: {
								volume: 0.25
							}
						}
					}),

					// run the transition
					literal<TimelineObjAtemME>({
						_id: IDs.atemSrv1Transition, deviceId: [''], siId: '', roId: '',
						trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.wipeVideo}.start + 0` },
						priority: 3,
						duration: 0,
						LLayer: LLayers.atem_me_program,
						content: {
							type: TimelineContentTypeAtem.ME,
							attributes: {
								input: KamFirstInput + cameraInput - 1,
								transition: Atem_Enums.TransitionStyle.WIPE,
								transitionSettings: AtemWipeSettings
							}
						}
					}),

					// fade out vignett audio
					literal<TimelineObjCCGVideo>({
						_id: IDs.vignettTransition, deviceId: [''], siId: '', roId: '',
						trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
						priority: 2,
						duration: 250,
						LLayer: LLayers.casparcg_player_vignett,
						content: {
							type: TimelineContentTypeCasparCg.VIDEO,
							transitions: {
								inTransition: {
									type: Transition.MIX,
									duration: LawoFadeInDuration,
									easing: Ease.LINEAR,
									direction: Direction.LEFT
								}
							},
							attributes: {
								file: 'EMPTY'
							}
						}
					}),

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

					// @todo audio levels
				])
			}
		}))

		overlapDuration = 480
	}

	segmentLineItems.push(literal<SegmentLineItemOptional>({
		_id: '',
		mosId: '',
		segmentLineId: '',
		runningOrderId: '',
		name: 'KAM ' + cameraInput,
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
							input: KamFirstInput + cameraInput - 1,
							transition: Atem_Enums.TransitionStyle.CUT
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
			slug: 'KAM',
			overlapDuration: overlapDuration
		}),
		segmentLineItems: segmentLineItems,
		segmentLineAdLibItems: null
	}
})

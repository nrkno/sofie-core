
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
import {
	IOutputLayer,
	ISourceLayer
} from '../../../lib/collections/StudioInstallations'
import {
	TemplateFunction,
	TemplateSet,
	SegmentLineItemOptional,
	TemplateFunctionOptional,
	TemplateResult,
	TemplateContextInner,
	StoryWithContext,
	SegmentLineAdLibItemOptional
} from './templates'
import {
	TimelineObjCCGVideo,
	TimelineObjLawoSource,
	TimelineObjCCGHTMLPage,
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

import { LLayers, NoraChannels, SourceLayers } from './nrk-layers'
import { AtemSource } from './nrk-inputs'
import { RunningOrderBaselineItem } from '../../../lib/collections/RunningOrderBaselineItems'

const literal = <T>(o: T) => o

const lawoDefaultOutDuration = 1400

export const NrkSorlandetBaseTemplate = literal<TemplateFunctionOptional>(function (context, story) {
	const noraGroup = process.env.MESOS_NORA_GROUP || 'dksl' // @todo config not env
	const clearParams: any = {
		render: {
			channel: NoraChannels.super,
			group: noraGroup,
			system: 'html',
		},
		playout: {
			event: 'takeout',
			template: 'navnesuper',
			layer: 'super'
		},
		content: {}
	}

	let IDs = {
		atemSrv1: context.getHashId('atemSrv1'),
		atemSrv1Transition: context.getHashId('atemSrv1Transition'),
		wipeVideo: context.getHashId('wipeVideo'),
		wipeAudioPunktum: context.getHashId('wipeAudioPunktum'),
		vignettTransition: context.getHashId('vignettTransition'),
		lawo_effect: context.getHashId('lawo_effect'),
		lawo_automix: context.getHashId('lawo_automix'),
	}

	function makeCameraAdLib (cameraInput): SegmentLineAdLibItemOptional {
		return literal<SegmentLineAdLibItemOptional>({
			_id: '',
			mosId: '',
			segmentLineId: '',
			runningOrderId: '',
			name: 'KAM ' + cameraInput,
			trigger: undefined,
			status: RundownAPI.LineItemStatusCode.UNKNOWN,
			sourceLayerId: SourceLayers.camera0,
			outputLayerId: 'pgm0',
			expectedDuration: 0,
			content: {
				timelineObjects: _.compact([
					literal<TimelineObjAtemME>({
						_id: IDs.atemSrv1, deviceId: [''], siId: '', roId: '',
						trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
						priority: 1,
						duration: 0, // @todo TBD
						LLayer: LLayers.atem_me_program,
						content: {
							type: TimelineContentTypeAtem.ME,
							attributes: {
								input: cameraInput,
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
		})
	}

	return literal<TemplateResult>({
		segmentLine: null,
		segmentLineItems: null,
		segmentLineAdLibItems: [
			makeCameraAdLib(1),
			makeCameraAdLib(2),
			makeCameraAdLib(3)
		],
		baselineItems: [
			literal<RunningOrderBaselineItem>({
				segmentLineId: undefined,
				trigger: { type: 0, value: 0 },
				disabled: false,
				expectedDuration: 0,
				transitions: undefined,
				continuesRefId: undefined,
				adLibSourceId: undefined,

				_id: 'baseline',
				mosId: 'baseline',
				runningOrderId: '',
				name: 'baseline',
				status: RundownAPI.LineItemStatusCode.UNKNOWN,
				sourceLayerId: SourceLayers.camera0,
				outputLayerId: 'pgm0',

				content: {
					timelineObjects: [
						// Default timeline
						literal<TimelineObjAtemME>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.atem_me_program,
							content: {
								type: TimelineContentTypeAtem.ME,
								// transitions?: {
								//     inTransition?: TimelineTransition
								// }
								attributes: {
									input: AtemSource.Default,
									transition: Atem_Enums.TransitionStyle.CUT
								}
							}
						}),
						literal<TimelineObjAtemME>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.atem_me_studiomonitor,
							content: {
								type: TimelineContentTypeAtem.ME,
								// transitions?: {
								//     inTransition?: TimelineTransition
								// }
								attributes: {
									input: AtemSource.Server2,
									transition: Atem_Enums.TransitionStyle.CUT
								}
							}
						}),
						literal<TimelineObjAtemAUX>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.atem_aux_clean,
							content: {
								type: TimelineContentTypeAtem.AUX,
								attributes: {
									input: Atem_Enums.SourceIndex.Cfd1
								}
							}
						}),
						literal<TimelineObjAtemAUX>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.atem_aux_preview,
							content: {
								type: TimelineContentTypeAtem.AUX,
								attributes: {
									input: Atem_Enums.SourceIndex.Prv1
								}
							}
						}),
						literal<TimelineObjAtemDSK>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.atem_dsk_graphics,
							content: {
								type: TimelineContentTypeAtem.DSK,
								attributes: {
									onAir: true,
									sources: {
										fillSource: AtemSource.DSK1F,
										cutSource: AtemSource.DSK1K
									},
									properties: {
										tie: false,
										preMultiply: true,
										mask: {
											enabled: false
										}
									}
								}
							}
						}),
						literal<TimelineObjAtemDSK>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.atem_dsk_effect,
							content: {
								type: TimelineContentTypeAtem.DSK,
								attributes: {
									onAir: true,
									sources: {
										fillSource: AtemSource.DSK2F,
										cutSource: AtemSource.DSK2K
									},
									properties: {
										tie: false,
										preMultiply: true,
										mask: {
											enabled: false
										}
									}
								}
							}
						}),
						// @todo setup me1k2 to be the same as dsk2, but default disabled
						literal<TimelineObjAtemSsrc>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0,
							duration: 0,
							LLayer: LLayers.atem_supersource,
							content: {
								type: TimelineContentTypeAtem.SSRC,
								attributes: {
									boxes: [
										literal<SuperSourceBox>({ // left
											enabled: true,
											source: Atem_Enums.SourceIndex.Bars,
											size: 570,
											x: -800,
											y: 47,
											cropped: true,
											cropRight: 2000,
										}),
										literal<SuperSourceBox>({ // right
											enabled: true,
											source: Atem_Enums.SourceIndex.Bars,
											size: 570,
											x: 800,
											y: 47,
											// note: this sits behind box1, so don't crop it to ensure there is no gap between
										}),
										literal<SuperSourceBox>({ // background
											enabled: true,
											source: AtemSource.Server3,
											size: 1000,
										}),
									],
									// artfillSource: AtemSource.SSrcArtFill,
								}
							}
						}),

						literal<TimelineObjLawoSource>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.lawo_source_automix,
							content: {
								type: TimelineContentTypeLawo.AUDIO_SOURCE,
								transitions: {
									inTransition: {
										type: Transition.MIX,
										duration: lawoDefaultOutDuration,
										easing: Ease.LINEAR,
										direction: Direction.LEFT
									}
								},
								attributes: {
									db: -191
								}
							}
						}),
						literal<TimelineObjLawoSource>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.lawo_source_clip,
							content: {
								type: TimelineContentTypeLawo.AUDIO_SOURCE,
								transitions: {
									inTransition: {
										type: Transition.MIX,
										duration: lawoDefaultOutDuration,
										easing: Ease.LINEAR,
										direction: Direction.LEFT
									}
								},
								attributes: {
									db: -191
								}
							}
						}),
						literal<TimelineObjLawoSource>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.lawo_source_effect,
							content: {
								type: TimelineContentTypeLawo.AUDIO_SOURCE,
								transitions: {
									inTransition: {
										type: Transition.MIX,
										duration: lawoDefaultOutDuration,
										easing: Ease.LINEAR,
										direction: Direction.LEFT
									}
								},
								attributes: {
									db: -191
								}
							}
						}),
						literal<TimelineObjLawoSource>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.lawo_source_preview,
							content: {
								type: TimelineContentTypeLawo.AUDIO_SOURCE,
								transitions: {
									inTransition: {
										type: Transition.MIX,
										duration: lawoDefaultOutDuration,
										easing: Ease.LINEAR,
										direction: Direction.LEFT
									}
								},
								attributes: {
									db: 0
								}
							}
						}),
						literal<TimelineObjLawoSource>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.lawo_source_rm1,
							content: {
								type: TimelineContentTypeLawo.AUDIO_SOURCE,
								transitions: {
									inTransition: {
										type: Transition.MIX,
										duration: lawoDefaultOutDuration,
										easing: Ease.LINEAR,
										direction: Direction.LEFT
									}
								},
								attributes: {
									db: -191
								}
							}
						}),
						literal<TimelineObjLawoSource>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.lawo_source_rm2,
							content: {
								type: TimelineContentTypeLawo.AUDIO_SOURCE,
								transitions: {
									inTransition: {
										type: Transition.MIX,
										duration: lawoDefaultOutDuration,
										easing: Ease.LINEAR,
										direction: Direction.LEFT
									}
								},
								attributes: {
									db: -191
								}
							}
						}),
						literal<TimelineObjLawoSource>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.lawo_source_rm3,
							content: {
								type: TimelineContentTypeLawo.AUDIO_SOURCE,
								transitions: {
									inTransition: {
										type: Transition.MIX,
										duration: lawoDefaultOutDuration,
										easing: Ease.LINEAR,
										direction: Direction.LEFT
									}
								},
								attributes: {
									db: -191
								}
							}
						}),

						literal<TimelineObjCCGHTMLPage>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.casparcg_cg_graphics,
							content: {
								type: TimelineContentTypeCasparCg.HTMLPAGE,
								attributes: {
									url: 'http://nora.render.nyheter.mesosint.nrk.no/?group=' + noraGroup + '&channel=' + NoraChannels.super + '&name=sofie-dev-cg&_=' + Date.now()
								}
							}
						}),
						literal<TimelineObjCCGHTMLPage>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.casparcg_cg_logo,
							content: {
								type: TimelineContentTypeCasparCg.HTMLPAGE,
								attributes: {
									url: 'http://nora.render.nyheter.mesosint.nrk.no/?group=' + noraGroup + '&channel=' + NoraChannels.logo + '&name=sofie-dev-logo&_=' + Date.now()
								}
							}
						}),
						literal<TimelineObjCCGHTMLPage>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.casparcg_cg_studiomonitor,
							content: {
								type: TimelineContentTypeCasparCg.HTMLPAGE,
								attributes: {
									url: 'http://nora.render.nyheter.mesosint.nrk.no/?group=' + noraGroup + '&channel=' + NoraChannels.studio + '&name=sofie-dev-studio&_=' + Date.now()
								}
							}
						}),

						// @todo remove this/make more generic/dynamic
						literal<TimelineObjHTTPPost>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.casparcg_cg_graphics_ctrl,
							content: {
								type: TimelineContentTypeHttp.POST,
								url: 'http://nora.core.mesosint.nrk.no/api/playout?apiKey=' + process.env.MESOS_API_KEY, // @todo url needs to vary too
								params: clearParams
							}
						})
					]
				}
			})
		]
	})
})

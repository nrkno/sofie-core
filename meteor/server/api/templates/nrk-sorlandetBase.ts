
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
	StoryWithContext
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
	TimelineObjHTTPPost,
	TimelineContentTypeHttp
} from '../../../lib/collections/Timeline'
import { Transition, Ease, Direction } from '../../../lib/constants/casparcg'
import { Optional } from '../../../lib/lib'

import { LLayers } from './nrk-layers'
import { AtemSource } from './nrk-inputs'
import { RunningOrderBaselineItem } from '../../../lib/collections/RunningOrderBaselineItems'

const literal = <T>(o: T) => o

export const NrkSorlandetBaseTemplate = literal<TemplateFunctionOptional>(function (context, story) {
	const clearParams: any = {
		render: {
			channel: 'gfx1',
			group: 'dksl',
			system: 'html',
		},
		playout: {
			event: 'takeout',
			template: 'navnesuper',
			layer: 'super'
		},
		content: {}
	}

	return literal<TemplateResult>({
		segmentLine: null,
		segmentLineItems: null,
		segmentLineAdLibItems: null,
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
				sourceLayerId: 'studio0_camera0',
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
									input: 2001, // to be changed?
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
									input: 1, // TMP! should be 16
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
								// transitions?: {
								//     inTransition?: TimelineTransition
								// }
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
								// transitions?: {
								//     inTransition?: TimelineTransition
								// }
								attributes: {
									input: Atem_Enums.SourceIndex.Prv1
								}
							}
						}),
						literal<TimelineObjAtemDSK>({ // @todo enabling this causes it to turn off after the segment
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.atem_dsk_graphics,
							content: {
								type: TimelineContentTypeAtem.DSK,
								// transitions?: {
								//     inTransition?: TimelineTransition
								// }
								attributes: {
									onAir: true,
									fillSource: AtemSource.DSK1F,
									keySource: AtemSource.DSK1K
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
								// transitions?: {
								//     inTransition?: TimelineTransition
								// }
								attributes: {
									onAir: true,
									fillSource: AtemSource.DSK2F,
									keySource: AtemSource.DSK2K
								}
							}
						}),
						// @todo setup me1k2 to be the same as dsk2, but default disabled

						literal<TimelineObjAtemSsrc>({
							_id: '', deviceId: [''], siId: '', roId: '',
							trigger: { type: TriggerType.LOGICAL, value: '1' },
							priority: 0, duration: 0,
							LLayer: LLayers.atem_dsk_effect,
							content: {
								type: TimelineContentTypeAtem.SSRC,
								// transitions?: {
								//     inTransition?: TimelineTransition
								// }
								attributes: {
									boxes: [
										{
											enabled: true,
											source: 1
										},
										{
											enabled: true,
											source: 4
										}
									],
									artfillSource: 16
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
								attributes: {
									db: 0
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
									url: 'http://nora.render.nyheter.mesosint.nrk.no/?group=dksl&channel=gfx1&name=sofie-dev-cg&_=' + Date.now()
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
									url: 'http://nora.render.nyheter.mesosint.nrk.no/?group=dksl&channel=gfx1&name=sofie-dev-logo&_=' + Date.now()
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
									url: 'http://nora.render.nyheter.mesosint.nrk.no/?group=dksl&channel=gfx2&name=sofie-dev-studio&_=' + Date.now()
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

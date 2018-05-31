
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
import { SegmentLineAdLibItems } from '../../../lib/collections/SegmentLineAdLibItems';

import { LLayers } from './nrk-layers'

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
                sourceLayerId: 'studio0_vignett',
                outputLayerId: 'pgm0',
                expectedDuration: 0,
                content: {
                    timelineObjects: [
                        // Default timeline
                        literal<TimelineObjAtemME>({
                            _id: '', deviceId: [''], siId: '', roId: '',
                            trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
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
                                    fillSource: 10,
                                    keySource: 11
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
                                    fillSource: 12,
                                    keySource: 13
                                }
                            }
                        }),
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
                                attributes:{
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
                                attributes:{
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
                                attributes:{
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
                                attributes:{
                                    url: 'http://design-nyheter.mesosint.nrk.no/?group=DKKristiansand&channel=gfx1'
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
                                attributes:{
                                    url: 'http://design-nyheter.mesosint.nrk.no/?group=DKKristiansand&channel=gfx1'
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
                                attributes:{
                                    url: 'http://design-nyheter.mesosint.nrk.no/?group=DKKristiansand&channel=gfx2'
                                }
                            }
                        })
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
            // 	sourceLayerId: 'studio0_vignett',
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
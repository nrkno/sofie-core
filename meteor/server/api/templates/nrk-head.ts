
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
import { SegmentLineAdLibItems } from '../../../lib/collections/SegmentLineAdLibItems';

import { LLayers } from './nrk-layers'

const literal = <T>(o: T) => o

export const NrkHeadTemplate = literal<TemplateFunctionOptional>(function (context, story) {
    let IDs = {
        lawo_automix: 		context.getHashId('lawo_automix'),
        lawo_effect: 		context.getHashId('lawo_effect'),
        headVideo: 			context.getHashId('headVideo'),
        atemSrv1: 			context.getHashId('atemSrv1'),
        wipeVideo: 			context.getHashId('wipeVideo'),
        wipeAudioSkille: 	context.getHashId('wipeAudioSkille'),
        headGfx: 			context.getHashId('headGfx'),
        playerClip: 		context.getHashId('playerClip'),
        vignett: context.getHashId('vignett')
    }
    
    let segmentLines = context.getSegmentLines()
    let segmentTitleMin = -1
    let segmentTitleMax = -1
    for (let sl of segmentLines){
        if (sl.segmentId != context.segmentLine.segmentId) {
            if (segmentTitleMin != -1) {
                break
            }

            continue
        }
        if (segmentTitleMin === -1) {
            segmentTitleMin = sl._rank
        }
        segmentTitleMax = sl._rank
    }

    // @todo this number assumes a certain flow. _rank starts at 1
    let isFirstHeadAfterVignett = (context.segmentLine._rank === segmentTitleMin + 1)
    let isLastHead = (context.segmentLine._rank === segmentTitleMax - 1)

    if (!isFirstHeadAfterVignett) {
        context.segmentLine.overlapDuration = 300 // TODO properly
    }    

    let storyItemClip = _.find(story.Body, (item) => {
        return (
            item.Type === 'storyItem' &&
            context.getValueByPath(item, 'Content.mosExternalMetadata.mosPayload.objectType')
                === 'CLIP'
        )
    })
    if (!storyItemClip) context.warning('Clip missing in mos data')
    let storyItemGfx = _.find(story.Body, (item) => {
        return ( // @todo I dont see anything that vaguely matches this
            item.Type === 'storyItem' &&
            context.getValueByPath(item, 'Content.mosExternalMetadata.mosPayload.subtype')
                === 'lyric/data'
            // context.getValueByPath(item, 'Content.mosID') // for kompatibilitet med ny grafikk
            // === 'GFX.NRK.MOS'
        )
    })
    if (!storyItemGfx) context.warning('Super missing in mos data')

    let clip = context.getValueByPath(storyItemClip, 'Content.mosExternalMetadata.mosPayload.title', 'clipPlaceholder') // @todo Is this correct?
    if (!clip || clip == '') context.warning('Clip name missing in mos data')

    // Copy the vignett from the previous segmentLine if it was found. 
    // @todo make this more durable and refactor to reusable.
    // @todo look into if this can be automated more. eg if content is null that means persist from before if found
    let prev_content = segmentLines[segmentTitleMin].getSegmentLinesItems()[0].content
    let vignet_obj: TimelineObjCCGVideo | null | undefined
    if (prev_content && prev_content.timelineObjects){
        vignet_obj = prev_content.timelineObjects.find((o: TimelineObj) => o.LLayer == LLayers.casparcg_player_vignett) as TimelineObjCCGVideo
        if (vignet_obj) {
            vignet_obj = literal<TimelineObjCCGVideo>({
                _id: IDs.vignett, deviceId: [''], siId: '', roId: '',
                trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
                priority: 1,
                duration: vignet_obj.duration,
                LLayer: LLayers.casparcg_player_vignett,
                content: vignet_obj.content
            })
        }
    }

    let segmentLineItems: Array<SegmentLineItemOptional> = []
    let video: SegmentLineItemOptional = {
        _id: context.getHashId('video'),
        mosId: 'headvideo',
        name: clip, // @todo is this the correct name to use?
        trigger: {
            type: TriggerType.TIME_ABSOLUTE,
            value: 0
        },
        status: RundownAPI.LineItemStatusCode.UNKNOWN,
        sourceLayerId: 'studio0_live_speak0',
        outputLayerId: 'pgm0',
        expectedDuration: ( // @todo rewrite this blob
            story.getValueByPath('MosExternalMetaData.0.MosPayload.Estimated') ||
            context.sumMosItemDurations(story.getValueByPath('MosExternalMetaData.0.MosPayload.MOSItemDurations')) ||
            story.getValueByPath('MosExternalMetaData.0.MosPayload.MediaTime') ||
            story.getValueByPath('MosExternalMetaData.0.MosPayload.SourceMediaTime') ||
            10
        ) * 1000, // transform into milliseconds
        content: {
            fileName: clip,
            sourceDuration: (
                context.getValueByPath(storyItemClip, 'Content.objDur', 0) /
                (context.getValueByPath(storyItemClip, 'Content.objTB') || 1)
            ) * 1000,
            timelineObjects: _.compact([

                // try and keep vignett running
                vignet_obj,

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
                // @todo what is the default state of this? could it cause a burst of noise at the start?
                // @todo task says -inf is desired
                literal<TimelineObjLawoSource>({
                    _id: IDs.lawo_effect, deviceId: [''], siId: '', roId: '',
                    trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + 0` },
                    priority: 1,
                    duration: 0,
                    LLayer: LLayers.lawo_source_clip,
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
                            input: 14,
                            transition: Atem_Enums.TransitionStyle.CUT
                        }
                    }
                }),

                // wipe to head (if not first head after vignett)
                (!isFirstHeadAfterVignett) ? 
                literal<TimelineObjCCGVideo>({
                    _id: IDs.wipeVideo, deviceId: [''], siId: '', roId: '',
                    trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + 0` },
                    priority: 1,
                    duration: 1440, //720, // @todo duration should be half this
                    LLayer: LLayers.casparcg_player_wipe,
                    content: {
                        type: TimelineContentTypeCasparCg.VIDEO,
                        attributes: {
                            file: 'wipe_white'
                        }
                    }
                }) : null,

                // wipe audio skille between 
                (!isFirstHeadAfterVignett) ?
                literal<TimelineObjCCGVideo>({
                    _id: IDs.wipeAudioSkille, deviceId: [''], siId: '', roId: '',
                    trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + 0` },
                    priority: 1,
                    duration: 3600,
                    LLayer: LLayers.casparcg_player_soundeffect,
                    content: {
                        type: TimelineContentTypeCasparCg.VIDEO,
                        attributes: {
                            file: 'DK_skille_head'
                        }
                    }
                }) : null,

                // play HEAD
                literal<TimelineObjCCGVideo>({
                    _id: IDs.playerClip, deviceId: [''], siId: '', roId: '',
                    trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + ${isFirstHeadAfterVignett ? 0 : 40}` }, // @todo check trigger point
                    priority: 1,
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
	                            duration: isFirstHeadAfterVignett ? 0 : 200,
	                            easing: Ease.LINEAR,
                                direction: Direction.LEFT
                            }
                        },
                        attributes: {
                            file: clip
                        }
                    }
                })
            ])
        }
    }
    segmentLineItems.push(video)

    let trigger: ITimelineTrigger = {
        type: TriggerType.TIME_RELATIVE,
        value: `#${video._id}.start + 0`
    }
    let triggerType = context.getValueByPath(storyItemGfx, 'Content.mosExternalMetadata.0.mosPayload.trigger','') + ''
    let outType = context.getValueByPath(storyItemGfx, 'Content.mosExternalMetadata.0.mosPayload.out','')

    let mosInTime = (parseFloat(context.getValueByPath(storyItemGfx, 'Content.mosExternalMetadata.0.mosPayload.in',0)) || 0)
    let mosDuration = (parseFloat(context.getValueByPath(storyItemGfx, 'Content.mosExternalMetadata.0.mosPayload.duration',0)) || 0 )

    if (triggerType.match(/auto/i)) {
        trigger = {
            type: TriggerType.TIME_RELATIVE,
            value: `#${video._id}.start + ${mosInTime}`
        }
    } else if (triggerType.match(/manual/i)) {
        // @todo: how to handle this?
        // probably create a new segmentlineitem?
        trigger = {
            type: TriggerType.TIME_RELATIVE,
            value: `#${video._id}.start + 0`
        }
    } else {
        context.warning('Unknown trigger: "' + triggerType + '"')
    }

    let gfx: SegmentLineItemOptional = {
        _id: context.getHashId('super'),
        mosId: 'super',
        name: 'Super',
        trigger: trigger,
        status: RundownAPI.LineItemStatusCode.UNKNOWN,
        sourceLayerId: 'studio0_graphics0',
        outputLayerId: 'pgm0',
        expectedDuration: 8 * 1000, // @todo TBD
        content: {
            fileName: clip,
            sourceDuration: 8 * 1000, // @todo TBD
            timelineObjects: [
                literal<TimelineObjCCGTemplate>({ // to be changed to NRKPOST-something
                    _id: IDs.headGfx, deviceId: [''], siId: '', roId: '',
                    trigger: {
                        type: TriggerType.TIME_RELATIVE,
                        value: `#${IDs.headVideo}.start + 5`
                    },
                    priority: 1,
                    duration: 8 * 1000, // @todo TBD
                    LLayer: LLayers.casparcg_cg_graphics,
                    content: {
                        type: TimelineContentTypeCasparCg.TEMPLATE, // to be changed to NRKPOST-something
                        attributes: {
                            name: 'nrkgfx', // @todo: TBD
                            useStopCommand: false
                        }
                    }
                })
            ]
        }
    }
    segmentLineItems.push(gfx)

    let segmentLineAdLibItems: Array<SegmentLineAdLibItemOptional> = []
    let optionalGfx: SegmentLineAdLibItemOptional = {
        _id: context.getHashId('superAdLib'),
        mosId: 'superAdLib',
        name: 'Super AdLib',
        status: RundownAPI.LineItemStatusCode.UNKNOWN,
        sourceLayerId: 'studio0_graphics0',
        outputLayerId: 'pgm0',
        content: {
            fileName: clip,
            sourceDuration: 8 * 1000, // @todo TBD
            timelineObjects: [
                literal<TimelineObjCCGTemplate>({ // to be changed to NRKPOST-something
                    _id: IDs.headGfx, deviceId: [''], siId: '', roId: '',
                    trigger: {
                        type: TriggerType.TIME_RELATIVE,
                        value: `#${IDs.headVideo}.start + 5`
                    },
                    priority: 1,
                    duration: 8 * 1000, // @todo TBD
                    LLayer: LLayers.casparcg_cg_graphics,
                    content: {
                        type: TimelineContentTypeCasparCg.TEMPLATE, // to be changed to NRKPOST-something
                        attributes: {
                            name: 'nrkgfx', // @todo: TBD
                            useStopCommand: false
                        }
                    }
                })
            ]
        }
    }
    segmentLineAdLibItems.push(optionalGfx)

    return literal<TemplateResult>({
        segmentLine: literal<DBSegmentLine>({
            _id: '',
            _rank: 0,
            mosId: '',
            segmentId: '',
            runningOrderId: '',
            slug: context.segmentLine._id,
            autoNext: isFirstHeadAfterVignett,
            overlapDuration: isFirstHeadAfterVignett ? 760 : 160,
        }),
        segmentLineItems: segmentLineItems,
        segmentLineAdLibItems: segmentLineAdLibItems
    })
})

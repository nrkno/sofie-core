
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

import { LLayers } from './nrk-layers'
import { isNumber } from 'util';

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
        wipeVideo: 			context.getHashId('wipeVideo'),
        wipeAudioPunktum: 	context.getHashId('wipeAudioPunktum'),
    }

    let components: TimelineObj[] = []

    let camTrigger: {
		type: TriggerType;
		value: number | string;
	} = { 
        type: TriggerType.TIME_ABSOLUTE,
        value: 0
    }

    let overlapDuration: number | undefined
    let transition = Atem_Enums.TransitionStyle.CUT

    // @todo try and move this to be run at the end of other templates, as it really is just an out animation for them

    // if previous SegmentLine is head, then wipe out of it
    let segmentLines = context.getSegmentLines()
    if ((context.segmentLine._rank > 1 && segmentLines[context.segmentLine._rank - 1].slug.indexOf(';head') > 0)) { // @todo make check better
        components.push(literal<TimelineObjCCGVideo>({
            _id: IDs.wipeVideo, deviceId: [''], siId: '', roId: '',
            trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
            priority: 1,
            duration: 720,
            LLayer: LLayers.casparcg_player_wipe,
            content: {
                type: TimelineContentTypeCasparCg.VIDEO,
                attributes: {
                    file: 'wipe_white'
                }
            }
        }))

        components.push(literal<TimelineObjCCGVideo>({
            _id: IDs.wipeAudioPunktum, deviceId: [''], siId: '', roId: '',
            trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.wipeVideo}.start + 0` },
            priority: 1,
            duration: 3900,
            LLayer: LLayers.casparcg_player_soundeffect,
            content: {
                type: TimelineContentTypeCasparCg.VIDEO,
                attributes: {
                    file: 'DK_punktum_etter_head'
                }
            }
        }))

        // @todo audio levels
        
        // delay the camera cut until the trigger point of the wipe
        camTrigger = { type: TriggerType.TIME_RELATIVE, value: `#${IDs.wipeVideo}.start + 120 + 120` } // @todo better trigger point
        // @todo - cam mix
        overlapDuration = 300
        transition = Atem_Enums.TransitionStyle.MIX
    }

    components.push(literal<TimelineObjAtemME>({
        _id: IDs.atemSrv1, deviceId: [''], siId: '', roId: '',
        trigger: camTrigger,
        priority: 1,
        duration: 0, // @todo TBD
        LLayer: LLayers.atem_me_program,
        content: {
            type: TimelineContentTypeAtem.ME,
            attributes: {
                input: cameraInput,
                transition: transition
            }
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
        segmentLineItems: [
            literal<SegmentLineItemOptional>({
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
                sourceLayerId: 'studio0_camera0',
                outputLayerId: 'pgm0',
                expectedDuration: ( // @todo rewrite this
                    story.getValueByPath('MosExternalMetaData.0.MosPayload.ElapsedTime') ||
                    5
                ) * 1000,
                content: {
                    timelineObjects: _.compact(components)
                }
            })
        ],
        segmentLineAdLibItems: null
    }
})

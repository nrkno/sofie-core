
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

    context.warning("Got camera " + cameraInput + " from " + mosartVariant)

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

    let components: TimelineObj[] = []

    let camTrigger: {
		type: TriggerType;
		value: number | string;
	} = { 
        type: TriggerType.TIME_ABSOLUTE,
        value: 0
    }



    // @todo check for prefix to kam number (eg ÅPNING3), which defines additional behaviour

    if (mosartVariant.indexOf('ÅPNING') === 0) {
        components.push(literal<TimelineObjCCGVideo>({
            _id: IDs.wipeVideo, deviceId: [''], siId: '', roId: '',
            trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
            priority: 1,
            duration: 2000,
            LLayer: LLayers.casparcg_player_wipe,
            content: {
                type: TimelineContentTypeCasparCg.VIDEO,
                attributes: {
                    file: 'wipe2' // @todo 'wipe_white'
                }
            }
        }))

        components.push(literal<TimelineObjCCGVideo>({
            _id: IDs.wipeAudioPunktum, deviceId: [''], siId: '', roId: '',
            trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.wipeVideo}.start + 0` },
            priority: 1,
            duration: 800,
            LLayer: LLayers.casparcg_player_soundeffect,
            content: {
                type: TimelineContentTypeCasparCg.VIDEO,
                attributes: {
                    file: 'wipe_audio_punktum'
                }
            }
        }))

        // @todo audio levels
        
        // delay the camera cut until the trigger point of the wipe
        camTrigger = { type: TriggerType.TIME_RELATIVE, value: `#${IDs.wipeVideo}.start + 1500` } // @todo better trigger point
    }

    components.push(literal<TimelineObjAtemME>({ // to be changed to NRKPOST-something
        _id: IDs.atemSrv1, deviceId: [''], siId: '', roId: '',
        trigger: camTrigger,
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
    }))

    return {
        segmentLine: null,
        /*literal<DBSegmentLine>({
            _id: '',
            _rank: 0,
            mosId: '',
            segmentId: '',
            runningOrderId: '',
            slug: 'KAM',
        }),*/
        segmentLineItems: [
            literal<SegmentLineItemOptional>({
                _id: '',
                mosId: '',
                segmentLineId: '',
                runningOrderId: '',
                name: 'KAM',
                trigger: {
                    type: TriggerType.TIME_ABSOLUTE,
                    value: 0
                },
                status: RundownAPI.LineItemStatusCode.UNKNOWN,
                sourceLayerId: 'studio0_vignett',
                outputLayerId: 'pgm0',
                expectedDuration: ( // @todo rewrite this
                    story.getValueByPath('MosExternalMetaData.0.MosPayload.ElapsedTime') ||
                    5
                ),
                content: {
                    timelineObjects: _.compact(components)
                }
            })
        ]
    }
})

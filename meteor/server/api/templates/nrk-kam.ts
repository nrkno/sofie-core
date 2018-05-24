
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
    let mosartVariant = story.getValueByPath('MosExternalMetaData.0.MosPayload.mosartVariant', '')
    if (mosartVariant) {
        // mosartVariant can be something like ÅPNING3, so strip anything non numeric
        if (mosartVariant.replace) {
            mosartVariant = mosartVariant.replace(/\D/g,'')
        }

        cameraInput = parseInt(mosartVariant, 10) || 0
    } else {
        context.warning('mosartVariant for KAM should be the camera to cut to')
    }

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
                status: RundownAPI.LineItemStatusCode.OK,
                sourceLayerId: 'studio0_vignett',
                outputLayerId: 'pgm0',
                expectedDuration: ( // @todo rewrite this
                    story.getValueByPath('MosExternalMetaData.0.MosPayload.ElapsedTime') ||
                    5
                ),
                content: {
                    timelineObjects: _.compact([
                        literal<TimelineObjAtemME>({ // to be changed to NRKPOST-something
                            _id: context.getHashId('atemSrv1'), deviceId: [''], siId: '', roId: '',
                            trigger: {
                                type: TriggerType.TIME_ABSOLUTE,
                                value: 0
                            },
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
                        })
                    ])
                }
            })
            
        ]
    }
})

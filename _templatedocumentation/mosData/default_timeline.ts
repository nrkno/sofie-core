import { TimelineContentType, TimelineObj, TimelineObjCCGVideo, TimelineObjLawoSource, TimelineObjAtemME, TimelineObjCCGTemplate, TimelineObjAtemDSK, TimelineObjAtemAUX, Atem_Enums, TimelineObjAtemSsrc } from '../../meteor/lib/collections/Timeline'
import { TriggerType } from 'superfly-timeline'

const literal = <T>(o: T) => o

const defaultTimeline = [

    literal<TimelineObjAtemME>({
        _id: '', deviceId: '',
        trigger: { type: TriggerType.LOGICAL, value: '1' },
        priority: -1, duration: 0,
        LLayer: 'atem_me_program',
        content: {
            type: TimelineContentType.ATEM_ME,
            // transitions?: {
            //     inTransition?: TimelineTransition
            // }
            attributes: {
                input: 1, // to be changed?
                transition: Atem_Enums.TransitionStyle.CUT
            }
        }
    }),
    literal<TimelineObjAtemME>({
        _id: '', deviceId: '',
        trigger: { type: TriggerType.LOGICAL, value: '1' },
        priority: -1, duration: 0,
        LLayer: 'atem_me_studiomonitor',
        content: {
            type: TimelineContentType.ATEM_ME,
            // transitions?: {
            //     inTransition?: TimelineTransition
            // }
            attributes: {
                input: 16,
                transition: Atem_Enums.TransitionStyle.CUT
            }
        }
    }),
    literal<TimelineObjAtemAUX>({
        _id: '', deviceId: '',
        trigger: { type: TriggerType.LOGICAL, value: '1' },
        priority: -1, duration: 0,
        LLayer: 'atem_aux_clean',
        content: {
            type: TimelineContentType.ATEM_AUX,
            // transitions?: {
            //     inTransition?: TimelineTransition
            // }
            attributes: {
                input: Atem_Enums.SourceIndex.Cfd1
            }
        }
    }),
    literal<TimelineObjAtemAUX>({
        _id: '', deviceId: '',
        trigger: { type: TriggerType.LOGICAL, value: '1' },
        priority: -1, duration: 0,
        LLayer: 'atem_aux_preview',
        content: {
            type: TimelineContentType.ATEM_AUX,
            // transitions?: {
            //     inTransition?: TimelineTransition
            // }
            attributes: {
                input: Atem_Enums.SourceIndex.Prv1
            }
        }
    }),
    literal<TimelineObjAtemDSK>({
        _id: '', deviceId: '',
        trigger: { type: TriggerType.LOGICAL, value: '1' },
        priority: -1, duration: 0,
        LLayer: 'atem_dsk_graphics',
        content: {
            type: TimelineContentType.ATEM_DSK,
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
        _id: '', deviceId: '',
        trigger: { type: TriggerType.LOGICAL, value: '1' },
        priority: -1, duration: 0,
        LLayer: 'atem_dsk_effect',
        content: {
            type: TimelineContentType.ATEM_DSK,
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
        _id: '', deviceId: '',
        trigger: { type: TriggerType.LOGICAL, value: '1' },
        priority: -1, duration: 0,
        LLayer: 'atem_dsk_effect',
        content: {
            type: TimelineContentType.ATEM_SSRC,
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
        _id: '', deviceId: '',
        trigger: { type: TriggerType.LOGICAL, value: '1' },
        priority: -1, duration: 0,
        LLayer: 'lawo_source_automix',
        content: {
            type: TimelineContentType.LAWO_AUDIO_SOURCE,
            attributes:{
                db: -191
            }
        }
    }),
    literal<TimelineObjLawoSource>({
        _id: '', deviceId: '',
        trigger: { type: TriggerType.LOGICAL, value: '1' },
        priority: -1, duration: 0,
        LLayer: 'lawo_source_clip',
        content: {
            type: TimelineContentType.LAWO_AUDIO_SOURCE,
            attributes:{
                db: -191
            }
        }
    }),
    literal<TimelineObjLawoSource>({
        _id: '', deviceId: '',
        trigger: { type: TriggerType.LOGICAL, value: '1' },
        priority: -1, duration: 0,
        LLayer: 'lawo_source_effect',
        content: {
            type: TimelineContentType.LAWO_AUDIO_SOURCE,
            attributes:{
                db: -191
            }
        }
    }),
    literal<TimelineObjLawoSource>({
        _id: '', deviceId: '',
        trigger: { type: TriggerType.LOGICAL, value: '1' },
        priority: -1, duration: 0,
        LLayer: 'lawo_source_preview',
        content: {
            type: TimelineContentType.LAWO_AUDIO_SOURCE,
            attributes:{
                db: 0
            }
        }
    }),
    literal<TimelineObjCCGTemplate>({
        _id: '', deviceId: '',
        trigger: { type: TriggerType.LOGICAL, value: '1' },
        priority: -1, duration: 0,
        LLayer: 'casparcg_cg_graphics',
        content: {
            type: TimelineContentType.TEMPLATE,
            attributes:{
                name: 'http://design-nyheter.mesosint.nrk.no/?group=DKKristiansand&channel=gfx1',
                data: {

                },
                useStopCommand: false
            }
        }
    }),
    literal<TimelineObjCCGTemplate>({
        _id: '', deviceId: '',
        trigger: { type: TriggerType.LOGICAL, value: '1' },
        priority: -1, duration: 0,
        LLayer: 'casparcg_cg_logo',
        content: {
            type: TimelineContentType.TEMPLATE,
            attributes:{
                name: 'http://design-nyheter.mesosint.nrk.no/?group=DKKristiansand&channel=gfx1',
                data: {

                },
                useStopCommand: false
            }
        }
    }),
    literal<TimelineObjCCGTemplate>({
        _id: '', deviceId: '',
        trigger: { type: TriggerType.LOGICAL, value: '1' },
        priority: -1, duration: 0,
        LLayer: 'casparcg_cg_studiomonitor',
        content: {
            type: TimelineContentType.TEMPLATE,
            attributes:{
                name: 'http://design-nyheter.mesosint.nrk.no/?group=DKKristiansand&channel=gfx2',
                data: {

                },
                useStopCommand: false
            }
        }
    })
]

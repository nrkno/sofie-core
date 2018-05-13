import { TimelineContentType, TimelineObj, TimelineObjCCGVideo, TimelineObjLawoSource, TimelineObjAtemME, TimelineObjCCGTemplate } from '../../meteor/lib/collections/Timeline'
import { TriggerType } from 'superfly-timeline'

const literal = <T>(o: T) => o

const defaultTimeline = [

    literal<TimelineObjAtemME>({
        _id: '', deviceId: '',
        trigger: { type: TriggerType.LOGICAL, value: '1' },
        priority: -1, duration: 0,
        LLayer: 'atem_me_pgm',
        content: {
            type: TimelineContentType.ATEM_ME,
            // transitions?: {
            //     inTransition?: TimelineTransition
            // }
            attributes: {
                input: 1, // to be changed?
                transition: Atem_Enums.TransitionStyle
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
                input: 16, // to be changed?
                transition: Atem_Enums.TransitionStyle
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

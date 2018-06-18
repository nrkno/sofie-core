import * as _ from 'underscore'

import { DBSegmentLine } from '../../../lib/collections/SegmentLines'
import { TriggerType } from 'superfly-timeline'
import { RundownAPI } from '../../../lib/api/rundown'
import {
	SegmentLineItemOptional,
	TemplateFunctionOptional,
	TemplateResult,
	TemplateContextInner,
} from './templates'
import {
	TimelineContentTypeLawo,
	TimelineContentTypeAtem,
	Atem_Enums,
	TimelineObjAtemME,
	TimelineObjLawoSource,
	EmberPlusValueType,
} from '../../../lib/collections/Timeline'
import { Transition, Ease, Direction } from '../../../lib/constants/casparcg'

import { LLayers, SourceLayers } from './nrk-layers'
import { RMFirstInput, LawoFadeInDuration } from './nrk-constants'

const literal = <T>(o: T) => o

export const NrkDirTemplate = literal<TemplateFunctionOptional>((context: TemplateContextInner, story): TemplateResult => {
	let variant = 1
	let mosartVariant = story.getValueByPath('MosExternalMetaData.0.MosPayload.mosartVariant', '') + ''
	if (mosartVariant) {
		// strip anything non numeric
		variant = parseInt(mosartVariant.replace(/\D/g,''), 10) || 1
	} else {
		context.warning('mosartVariant for DIR should be the camera to cut to')
	}

	let IDs = {
		atemSrv1: 			context.getHashId('atemSrv1'),
		lawo_effect:        context.getHashId('lawo_effect'),
		lawo_automix:       context.getHashId('lawo_automix'),
	}

	// @todo can this be made nicer?
	let lawoLayer = LLayers.lawo_source_rm1
	switch (variant) {
		case 1:
			lawoLayer = LLayers.lawo_source_rm1
			break
		case 2:
			lawoLayer = LLayers.lawo_source_rm2
			break
		case 3:
			lawoLayer = LLayers.lawo_source_rm3
			break
		default:
	}

	let segmentLineItems: Array<SegmentLineItemOptional> = []
	segmentLineItems.push(literal<SegmentLineItemOptional>({
		_id: '',
		mosId: '',
		segmentLineId: '',
		runningOrderId: '',
		name: 'RM ' + variant,
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
							input: RMFirstInput + variant - 1,
							transition: Atem_Enums.TransitionStyle.CUT
						}
					}
				}),

				// mic hot
				literal<TimelineObjLawoSource>({
					_id: IDs.lawo_automix, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
					priority: 1,
					duration: 0,
					LLayer: lawoLayer,
					content: {
						type: TimelineContentTypeLawo.SOURCE,
						attributes: {
							db: {
								value: 0,
								transitionDuration: LawoFadeInDuration,
							}
						}
					}
				}),
			])
		}
	}))

	// @todo parse graphics

	return {
		segmentLine: literal<DBSegmentLine>({
			_id: '',
			_rank: 0,
			mosId: '',
			segmentId: '',
			runningOrderId: '',
			slug: 'DIR',
		}),
		segmentLineItems: segmentLineItems,
		segmentLineAdLibItems: null
	}
})

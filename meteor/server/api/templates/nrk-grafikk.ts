import * as _ from 'underscore'

import { DBSegmentLine } from '../../../lib/collections/SegmentLines'
import { TriggerType } from 'superfly-timeline'
import { RundownAPI } from '../../../lib/api/rundown'
import {
	SegmentLineItemOptional,
	TemplateFunctionOptional,
	TemplateResult,
	TemplateContextInner,
	StoryWithContext
} from './templates'
import {
	TimelineObjCCGVideo,
	TimelineObjLawoSource,
	TimelineContentTypeCasparCg,
	TimelineContentTypeLawo,
	TimelineContentTypeAtem,
	Atem_Enums,
	TimelineObjAtemME,
	TimelineObjHTTPPost,
	TimelineContentTypeHttp,
} from '../../../lib/collections/Timeline'
import { Transition, Ease, Direction } from '../../../lib/constants/casparcg'

import { LLayers, SourceLayers } from './nrk-layers'
import { AtemSource, LawoFadeInDuration, CasparOutputDelay } from './nrk-constants'

const literal = <T>(o: T) => o

export function ParseGraffikData (context: TemplateContextInner, story: StoryWithContext): any {
	const storyItemGfx = _.find(story.Body, item => {
		return (
			item.Type === 'storyItem' &&
			context.getValueByPath(item, 'Content.mosID') === 'GFX.NRK.MOS'
		)
	})
	if (!storyItemGfx) {
		context.warning('Grafikk missing item')
		return
	}

	const itemID = context.getValueByPath(storyItemGfx, 'Content.itemID', 0)
	const name = context.getValueByPath(storyItemGfx, 'Content.mosAbstract', '')
	const metadata = context.getValueByPath(storyItemGfx, 'Content.mosExternalMetadata', [])
	const content = _.find(metadata, (m: any) => m.mosSchema === 'schema.nrk.no/content')

	if (!content) {
		context.warning('Grafikk missing content data')
		return
	}

	const payload = context.getValueByPath(content, 'mosPayload', {})
	const noraGroup = context.getConfigValue('nora_group', 'dksl')
	return {
		render: {
			channel: payload.render.channel,
			group: noraGroup,
			system: 'html',
		},
		playout: Object.assign(payload.playout, {
			event: 'take',
			autoTakeout: false, // This gets handled by timeline
			duration: 0,
			loop: false
		}),
		content: payload.content
	}
}

export const NrkGrafikkTemplate = literal<TemplateFunctionOptional>((context: TemplateContextInner, story): TemplateResult => {
	let IDs = {
		gfxPost:			context.getHashId('gfxPost'),
		atemSrv1: 			context.getHashId('atemSrv1'),
		lawo_automix:       context.getHashId('lawo_automix'),
		lawo_bed: 		    context.getHashId('lawo_bed'),
		playerBed:			context.getHashId('playerBed'),
	}

	// @todo does this field mean anything useful?
	let mosartVariant = story.getValueByPath('MosExternalMetaData.0.MosPayload.mosartVariant', '') + ''
	context.warning('Unknown variant: ' + mosartVariant)

	const gfxPayload = ParseGraffikData(context, story)

	const noraApiKey = context.getConfigValue('nora_apikey', '')

	let segmentLineItems: Array<SegmentLineItemOptional> = []
	segmentLineItems.push(literal<SegmentLineItemOptional>({
		_id: '',
		mosId: '',
		segmentLineId: '',
		runningOrderId: '',
		name: 'GRAFIKK',
		trigger: {
			type: TriggerType.TIME_ABSOLUTE,
			value: 0
		},
		status: RundownAPI.LineItemStatusCode.UNKNOWN,
		sourceLayerId: SourceLayers.graphics0,
		outputLayerId: 'pgm0',
		expectedDuration: ( // @todo rewrite this
			story.getValueByPath('MosExternalMetaData.0.MosPayload.Actual') ||
			story.getValueByPath('MosExternalMetaData.0.MosPayload.Estimated') ||
			0
		) * 1000,
		content: {
			timelineObjects: _.compact([
				(gfxPayload ?
				literal<TimelineObjHTTPPost>({
					_id: IDs.gfxPost, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_ABSOLUTE, value: 0 },
					priority: 1,
					duration: 0,
					LLayer: LLayers.casparcg_cg_graphics_ctrl, // @todo - this should be a seperate layer to ensure the right animations are run
					content: {
						type: TimelineContentTypeHttp.POST,
						url: 'http://nora.core.mesosint.nrk.no/api/playout?apiKey=' + noraApiKey,
						params: gfxPayload
					}
				}) : undefined),

				// automix mic hot
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
								duration: LawoFadeInDuration,
								easing: Ease.LINEAR,
								direction: Direction.LEFT
							}
						},
						attributes: {
							db: 0
						}
					}
				}),

				// audio bed
				literal<TimelineObjLawoSource>({
					_id: IDs.lawo_bed, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + 0` },
					priority: 1,
					duration: 0,
					LLayer: LLayers.lawo_source_clip,
					content: {
						type: TimelineContentTypeLawo.AUDIO_SOURCE,
						transitions: {
							inTransition: {
								type: Transition.MIX,
								duration: LawoFadeInDuration,
								easing: Ease.LINEAR,
								direction: Direction.LEFT
							}
						},
						attributes: {
							db: -15
						}
					}
				}),

				// preroll gfx a couple of frames before cutting to it
				literal<TimelineObjAtemME>({
					_id: IDs.atemSrv1, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + ${CasparOutputDelay} + 80` },
					priority: 1,
					duration: 0,
					LLayer: LLayers.atem_me_program,
					content: {
						type: TimelineContentTypeAtem.ME,
						attributes: {
							input: AtemSource.Grafikk,
							transition: Atem_Enums.TransitionStyle.CUT
						}
					}
				}),

				// play bed
				literal<TimelineObjCCGVideo>({
					_id: IDs.playerBed, deviceId: [''], siId: '', roId: '',
					trigger: { type: TriggerType.TIME_RELATIVE, value: `#${IDs.lawo_automix}.start + 0` },
					priority: 1,
					duration: 0, // hold at end
					LLayer: LLayers.casparcg_player_clip,
					content: {
						type: TimelineContentTypeCasparCg.VIDEO,
						attributes: {
							file: 'assets/grafikk_bed'
						}
					}
				}),
			])
		}
	}))

	return {
		segmentLine: literal<DBSegmentLine>({
			_id: '',
			_rank: 0,
			mosId: '',
			segmentId: '',
			runningOrderId: '',
			slug: 'GRAFIKK',
		}),
		segmentLineItems: segmentLineItems,
		segmentLineAdLibItems: null
	}
})

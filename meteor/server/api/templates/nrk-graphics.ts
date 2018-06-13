import * as _ from 'underscore'
import { ITimelineTrigger } from '../../../lib/collections/SegmentLineItems'
import { RundownAPI } from '../../../lib/api/rundown'
import {
	SegmentLineItemOptional,
	SegmentLineAdLibItemOptional,
	TemplateContextInner,
	StoryWithContext
} from './templates'
import { LLayers, NoraChannels, SourceLayers } from './nrk-layers'
import { NoraHostControlDefault } from './nrk-constants'
import { TriggerType } from 'superfly-timeline'
import { TimelineObjHTTPPost, TimelineContentTypeHttp } from '../../../lib/collections/Timeline'

const literal = <T>(o: T) => o

export function ParseSuperSegments (context: TemplateContextInner, story: StoryWithContext, segmentLineItems: SegmentLineItemOptional[], adlibItems: SegmentLineAdLibItemOptional[], groupId: string, videoId: string) {
	const storyItemGfx = _.filter(story.Body, item => {
		return (
			item.Type === 'storyItem' &&
			context.getValueByPath(item, 'Content.mosID') === 'GFX.NRK.MOS'
		)
	})

	for (const item of storyItemGfx) {
		const itemID = context.getValueByPath(item, 'Content.itemID', 0)
		const name = context.getValueByPath(item, 'Content.mosAbstract', '')
		const metadata = context.getValueByPath(item, 'Content.mosExternalMetadata', [])
		const timing = _.find(metadata, (m: any) => (m.mosSchema + '').endsWith('/timing'))
		const content = _.find(metadata, (m: any) => (m.mosSchema + '').endsWith('/content'))

		if (!timing) context.warning('Super missing timing data. Assuming adlib')
		if (!content) {
			context.warning('Super missing content data')
			continue
		}

		const payload = context.getValueByPath(content, 'mosPayload', {})
		const noraHost = context.getConfigValue('nora_host_control', NoraHostControlDefault)
		const noraGroup = context.getConfigValue('nora_group', 'dksl')
		const noraApiKey = context.getConfigValue('nora_apikey', '')
		const newPayload: any = {
			manifest: 'nyheter',
			template: {
				layer: payload.template.layer,
				name: payload.template.name,
				event: 'take',
			},
			content: payload.content
		}

		const inMode = context.getValueByPath(timing, 'mosPayload.in','') + ''
		const outMode = context.getValueByPath(timing, 'mosPayload.out','') + ''
		const duration = context.getValueByPath(timing, 'mosPayload.duration', 0)
		const inTime = context.getValueByPath(timing, 'mosPayload.timeIn', 0)

		let timelineTrigger: ITimelineTrigger = {
			type: TriggerType.TIME_RELATIVE,
			value: `#${videoId}.start + 0`
		}
		let groupTrigger: ITimelineTrigger = {
			type: TriggerType.TIME_RELATIVE,
			value: `#${groupId}.start + 0`
		}

		let isAdlib = false
		if (inMode.match(/auto/i)) {
			timelineTrigger = {
				type: TriggerType.TIME_RELATIVE,
				value: `#${videoId}.start + ${inTime}`
			}
			groupTrigger = {
				type: TriggerType.TIME_RELATIVE,
				value: `#${groupId}.start + ${inTime}`
			}
		} else {
			isAdlib = true
			context.warning('Unknown in mode: "' + inMode + '"')
		}

		const cmd = literal<TimelineObjHTTPPost>({
			_id: context.getHashId('super_post_' + itemID), deviceId: [''], siId: '', roId: '',
			trigger: timelineTrigger,
			priority: 1,
			duration: duration,
			LLayer: LLayers.casparcg_cg_graphics_ctrl,
			content: {
				type: TimelineContentTypeHttp.POST,
				url: noraHost + '/api/v1/renders/' + noraGroup + '/' + NoraChannels.super + '?apiKey=' + noraApiKey,
				params: newPayload
			}
		})

		if (isAdlib) {
			let gfx: SegmentLineAdLibItemOptional = {
				_id: context.getHashId('super_' + itemID),
				mosId: 'super', // TODO
				name: name,
				status: RundownAPI.LineItemStatusCode.UNKNOWN,
				sourceLayerId: SourceLayers.graphics0,
				outputLayerId: 'pgm0',
				expectedDuration: duration,
				content: {
					sourceDuration: duration,
					timelineObjects: [
						cmd
					]
				}
			}
			adlibItems.push(gfx)
		} else {
			let gfx: SegmentLineItemOptional = {
				_id: context.getHashId('super_' + itemID),
				mosId: 'super', // TODO
				name: name,
				trigger: groupTrigger,
				status: RundownAPI.LineItemStatusCode.UNKNOWN,
				sourceLayerId: SourceLayers.graphics0,
				outputLayerId: 'pgm0',
				expectedDuration: duration,
				isTransition: false,
				content: {
					sourceDuration: duration,
					timelineObjects: [
						cmd
					]
				}
			}

			segmentLineItems.push(gfx)
		}
	}
}

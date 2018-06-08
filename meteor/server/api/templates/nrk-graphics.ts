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
	SegmentLineAdLibItemOptional,
	TemplateFunctionOptional,
	TemplateResult,
	TemplateContextInner,
	StoryWithContext
} from './templates'
import {
	TimelineObjCCGVideo,
	TimelineObjLawoSource,
	TimelineObjCCGTemplate,
	TimelineContentTypeOther,
	TimelineContentTypeCasparCg,
	TimelineContentTypeLawo,
	TimelineContentTypeAtem,
	TimelineObj,
	TimelineObjAbstract,
	Atem_Enums,
	TimelineObjAtemME,
	TimelineObjAtemAUX,
	TimelineObjAtemDSK,
	TimelineObjAtemSsrc,
	TimelineObjHTTPPost,
	TimelineContentTypeHttp
} from '../../../lib/collections/Timeline'
import { Transition, Ease, Direction } from '../../../lib/constants/casparcg'
import { Optional } from '../../../lib/lib'
import { SegmentLineAdLibItems } from '../../../lib/collections/SegmentLineAdLibItems'

import { LLayers, NoraChannels, SourceLayers } from './nrk-layers'
import { AtemSource } from './nrk-constants'

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
		const timing = _.find(metadata, (m: any) => m.mosSchema === 'schema.nrk.no/timing')
		const content = _.find(metadata, (m: any) => m.mosSchema === 'schema.nrk.no/content')

		if (!timing) context.warning('Super missing timing data. Assuming adlib')
		if (!content) {
			context.warning('Super missing content data')
			continue
		}

		const payload = context.getValueByPath(content, 'mosPayload', {})
		const noraGroup = process.env.MESOS_NORA_GROUP || 'dksl' // @todo config not env
		const newPayload: any = {
			render: {
				channel: NoraChannels.super,
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
			value: `#${videoId}.start + 0`
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
				url: 'http://nora.core.mesosint.nrk.no/api/playout?apiKey=' + process.env.MESOS_API_KEY,
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

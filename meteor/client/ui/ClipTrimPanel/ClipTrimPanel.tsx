import * as React from 'react'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { SegmentLineItems, SegmentLineItem } from '../../../lib/collections/SegmentLineItems'
import { PubSub } from '../../../lib/api/pubsub'
import { VTContent } from 'tv-automation-sofie-blueprints-integration'
import { VideoEditMonitor } from './VideoEditMonitor'
import { MediaObjects, MediaObject } from '../../../lib/collections/MediaObjects'
import { StudioInstallation, StudioInstallations } from '../../../lib/collections/StudioInstallations'

export interface IProps {
	segmentLineItemId: string
	runningOrderId: string
	segmentLineId: string
	studioInstallationId: string
}

interface ITrackedProps {
	segmentLineItem: SegmentLineItem | undefined
	mediaObject: MediaObject | undefined
	studioInstallation: StudioInstallation | undefined
}

export const ClipTrimPanel = translateWithTracker<IProps, {}, ITrackedProps>((props: IProps) => {
	const sli = SegmentLineItems.findOne(props.segmentLineItemId)
	const si = StudioInstallations.findOne(props.studioInstallationId)
	return {
		segmentLineItem: sli,
		mediaObject: sli ? MediaObjects.findOne({
			mediaId: (sli.content as VTContent).fileName.toUpperCase()
		}) : undefined,
		studioInstallation: si
	}
})(class ClipTrimPanel extends MeteorReactComponent<Translated<IProps> & ITrackedProps, {}> {
	componentDidMount () {
		this.subscribe(PubSub.segmentLineItems, { _id: this.props.segmentLineItemId })
		this.autorun(() => {
			if (this.props.segmentLineItem && this.props.segmentLineItem.content && this.props.segmentLineItem.content.fileName) {
				const sli = this.props.segmentLineItem
				let objId: string | undefined = undefined
				objId = (sli.content as VTContent).fileName.toUpperCase()

				if (objId) {
					// if (this.mediaObjectSub) this.mediaObjectSub.stop()
					this.subscribe(PubSub.mediaObjects, this.props.studioInstallationId, {
						mediaId: objId
					})
				}
			}
		})
	}

	render () {
		let previewUrl: string | undefined = undefined
		if (this.props.mediaObject && this.props.studioInstallation) {
			const mediaPreviewUrl = this.ensureHasTrailingSlash(this.props.studioInstallation.settings.mediaPreviewsUrl + '' || '') || ''
			previewUrl = mediaPreviewUrl + 'media/preview/' + encodeURIComponent(this.props.mediaObject.mediaId)
		}

		return (
			<div className='clip-trim-panel'>
				<div className='clip-trim-panel__monitors'>
					<div className='clip-trim-panel__monitors__monitor'>
						<VideoEditMonitor src={previewUrl} />
					</div>
					<div className='clip-trim-panel__monitors__monitor'>
						<VideoEditMonitor src={previewUrl} />
					</div>
				</div>
				<div className='clip-trim-panel__timecode-encoders'>
				</div>
			</div>
		)
	}

	private ensureHasTrailingSlash(input: string | null): string | null {
		if (input) {
			return (input.substr(-1) === '/') ? input : input + '/'
		} else {
			return input
		}
	}
})

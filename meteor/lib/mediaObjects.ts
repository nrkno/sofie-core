import { SegmentLineItem, VTContent, LiveSpeakContent } from './collections/SegmentLineItems'
import { RundownAPI } from './api/rundown'
import { MediaObjects, MediaInfo, MediaObject } from './collections/MediaObjects'
import { ISourceLayer } from './collections/StudioInstallations'

export function checkSLIContentStatus (sli: SegmentLineItem, sourceLayer: ISourceLayer) {
	let newStatus: RundownAPI.LineItemStatusCode = RundownAPI.LineItemStatusCode.UNKNOWN
	let metadata: MediaObject | null = null
	let message: string | null = null

	switch (sourceLayer.type) {
		case RundownAPI.SourceLayerType.VT:
			if (sli.content && sli.content.fileName) {
				const content = sli.content as VTContent
				const mediaObject = MediaObjects.findOne({
					mediaId: content.fileName.toUpperCase()
				})
				// If media object not found, then...
				if (!mediaObject) {
					newStatus = RundownAPI.LineItemStatusCode.SOURCE_MISSING
					message = 'Source is missing: ' + content.fileName
					// All VT content should have at least two streams
				} else if (mediaObject && mediaObject.mediainfo && mediaObject.mediainfo.streams.length < 2) {
					newStatus = RundownAPI.LineItemStatusCode.SOURCE_BROKEN
					message = 'Source doesn\'t have audio & video: ' + content.fileName
				} else if (mediaObject) {
					newStatus = RundownAPI.LineItemStatusCode.OK
				}

				if (mediaObject) {
					metadata = mediaObject
				}
			}
			break
		case RundownAPI.SourceLayerType.LIVE_SPEAK:
			if (sli.content && sli.content.fileName) {
				const content = sli.content as LiveSpeakContent
				const mediaObject = MediaObjects.findOne({
					mediaId: content.fileName.toUpperCase()
				})
				// If media object not found, then...
				if (!mediaObject) {
					newStatus = RundownAPI.LineItemStatusCode.SOURCE_MISSING
					message = 'Source is missing: ' + content.fileName
					// All VT content should have at least two streams
				} else if (mediaObject && mediaObject.mediainfo && mediaObject.mediainfo.streams.length < 2) {
					newStatus = RundownAPI.LineItemStatusCode.SOURCE_BROKEN
					message = 'Source doesn\'t have audio & video: ' + content.fileName
				} else if (mediaObject) {
					newStatus = RundownAPI.LineItemStatusCode.OK
				}

				if (mediaObject) {
					metadata = mediaObject
				}
			}
			break
	}

	return {
		status: newStatus,
		metadata: metadata,
		message: message
	}
}

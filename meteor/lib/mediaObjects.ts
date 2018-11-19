import { SegmentLineItem } from './collections/SegmentLineItems'
import { SourceLayerType, VTContent, LiveSpeakContent } from 'tv-automation-sofie-blueprints-integration'
import { RunningOrderAPI } from './api/runningOrder'
import { MediaObjects, MediaInfo, MediaObject, FieldOrder, MediaStream } from './collections/MediaObjects'
import { ISourceLayer, IStudioConfigItem } from './collections/StudioInstallations'

/**
 * Take properties from the mediainfo / medistream and transform into a
 * formatted string
 */
export function buildFormatString (mediainfo: MediaInfo, stream: MediaStream): string {
	let format = `${stream.width || 0}x${stream.height || 0}`
	switch (mediainfo.field_order) {
		case FieldOrder.Progressive :
			format += 'p'
			break
		case FieldOrder.Unknown :
			format += '?'
			break
		default :
			format += 'i'
			break
	}
	if (stream.codec.time_base) {
		const formattedTimebase = /(\d+)\/(\d+)/.exec(stream.codec.time_base) as RegExpExecArray
		let fps = Number(formattedTimebase[2])
		fps = Math.floor(fps * 100)
		format += fps
	}
	switch (mediainfo.field_order) {
		case FieldOrder.BFF :
			format += 'bff'
			break
		case FieldOrder.TFF :
			format += 'tff'
			break
		default :
			break
	}

	return format
}

/**
 * Checks if a source format is an accepted format by doing:
 * For every accepted format, check every parameter (w, h, p/i, fps) against the
 * parameter in the source format. If any of them are not the same: fail for that
 * accepted resolution and move to the next accepted resolution.
 */
export function acceptFormat (format: string, formats: Array<Array<string>>): boolean {
	const mediaFormat = /((\d+)x(\d+))?((i|p|\?)(\d+))?((tff)|(bff))?/.exec(format)!
		.filter((o, i) => new Set([2, 3, 5, 6, 7]).has(i))
	for (const format of formats) {
		let failed = false
		for (const param in format) {
			if (format[param] && format[param] !== mediaFormat[param]) {
				failed = true
				break
			}
		}
		if (!failed) return true
	}
	return false
}

/**
 * Convert config field "1920x1080i5000, 1280x720, i5000, i5000tff" into:
 * [
 * 	[1920, 1080, i, 5000, undefined],
 * 	[1280, 720, undefined, undefined, undefined],
 * 	[undefined, undefined, i, 5000, undefined],
 * 	[undefined, undefined, i, 5000, tff]
 * ]
 */
export function getAcceptedFormats (config: Array<IStudioConfigItem>): Array<Array<string>> {
	const formatsConfigField = config.find((item) => item._id === 'mediaResolutions')
	const formatsString = formatsConfigField && formatsConfigField.value !== '' ? formatsConfigField.value : '1920x1080i5000'
	return formatsString
		.split(', ')
		.map(res => /((\d+)x(\d+))?((i|p|\?)(\d+))?((tff)|(bff))?/.exec(res)!
			.filter((o, i) => new Set([2, 3, 5, 6, 7]).has(i)))
}

export function checkSLIContentStatus (sli: SegmentLineItem, sourceLayer: ISourceLayer, config: Array<IStudioConfigItem>) {
	let newStatus: RunningOrderAPI.LineItemStatusCode = RunningOrderAPI.LineItemStatusCode.UNKNOWN
	let metadata: MediaObject | null = null
	let message: string | null = null

	switch (sourceLayer.type) {
		case SourceLayerType.VT:
			if (sli.content && sli.content.fileName) {
				const content = sli.content as VTContent
				const mediaObject = MediaObjects.findOne({
					mediaId: content.fileName.toUpperCase()
				})
				// If media object not found, then...
				if (!mediaObject) {
					newStatus = RunningOrderAPI.LineItemStatusCode.SOURCE_MISSING
					message = 'Source is missing: ' + content.fileName
					// All VT content should have at least two streams
				} else if (mediaObject && mediaObject.mediainfo && mediaObject.mediainfo.streams.length < 2) {
					newStatus = RunningOrderAPI.LineItemStatusCode.SOURCE_BROKEN
					message = 'Source doesn\'t have audio & video: ' + content.fileName
				} else if (mediaObject) {
					newStatus = RunningOrderAPI.LineItemStatusCode.OK

					// Do a format check:
					if (mediaObject.mediainfo) {
						const formats = getAcceptedFormats(config)

						// check the streams for resolution info
						for (const stream of mediaObject.mediainfo.streams) {
							if (stream.width && stream.height) {
								const format = buildFormatString(mediaObject.mediainfo, stream)
								if (!acceptFormat(format, formats)) {
									newStatus = RunningOrderAPI.LineItemStatusCode.SOURCE_BROKEN
									message = `Source format (${format}) is not in accepted formats`
								}
							}
						}
					}
				}

				if (mediaObject) {
					metadata = mediaObject
				}
			}
			break
		case SourceLayerType.LIVE_SPEAK:
			if (sli.content && sli.content.fileName) {
				const content = sli.content as LiveSpeakContent
				const mediaObject = MediaObjects.findOne({
					mediaId: content.fileName.toUpperCase()
				})
				// If media object not found, then...
				if (!mediaObject) {
					newStatus = RunningOrderAPI.LineItemStatusCode.SOURCE_MISSING
					message = 'Source is missing: ' + content.fileName
					// All VT content should have at least two streams
				} else if (mediaObject && mediaObject.mediainfo && mediaObject.mediainfo.streams.length < 2) {
					newStatus = RunningOrderAPI.LineItemStatusCode.SOURCE_BROKEN
					message = 'Source doesn\'t have audio & video: ' + content.fileName
				} else if (mediaObject) {
					newStatus = RunningOrderAPI.LineItemStatusCode.OK

					// not being in the right format can cause issue with CasparCG
					if (mediaObject.mediainfo) {
						const formats = getAcceptedFormats(config)
						for (const stream of mediaObject.mediainfo.streams) {
							if (stream.width && stream.height) {
								const format = buildFormatString(mediaObject.mediainfo, stream)
								if (!acceptFormat(format, formats)) {
									newStatus = RunningOrderAPI.LineItemStatusCode.SOURCE_BROKEN
									message = `Source format (${format}) is not in accepted formats`
								}
							}
						}
					}
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

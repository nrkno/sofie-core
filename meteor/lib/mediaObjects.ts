import * as _ from 'underscore'
import { SegmentLineItem } from './collections/SegmentLineItems'
import {
	VTContent,
	SourceLayerType,
	IConfigItem,
	ISourceLayer
} from 'tv-automation-sofie-blueprints-integration'
import { RunningOrderAPI } from './api/runningOrder'
import { MediaObjects, MediaInfo, MediaObject, FieldOrder, MediaStream, Anomaly } from './collections/MediaObjects'

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
	const match = /((\d+)x(\d+))?((i|p|\?)(\d+))?((tff)|(bff))?/.exec(format)
	if (!match) return false // ingested format string is invalid

	const mediaFormat = match
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
export function getAcceptedFormats (config: Array<IConfigItem>): Array<Array<string>> {
	const formatsConfigField = config.find((item) => item._id === 'mediaResolutions')
	const formatsString: string = (formatsConfigField && formatsConfigField.value !== '' ? formatsConfigField.value : '1920x1080i5000') + ''
	return _.compact(formatsString
		.split(',')
		.map((res) => {
			const match = /((\d+)x(\d+))?((i|p|\?)(\d+))?((tff)|(bff))?/.exec(res)
			if (match) {
				return match.filter((o, i) => new Set([2, 3, 5, 6, 7]).has(i))
			} else {
				// specified format string was invalid
				return false
			}
		}))
}

export function checkSLIContentStatus (sli: SegmentLineItem, sourceLayer: ISourceLayer, config: Array<IConfigItem>) {
	let newStatus: RunningOrderAPI.LineItemStatusCode = RunningOrderAPI.LineItemStatusCode.UNKNOWN
	let metadata: MediaObject | null = null
	let message: string | null = null

	switch (sourceLayer.type) {
		case SourceLayerType.VT:
		case SourceLayerType.LIVE_SPEAK:
			if (sli.content && sli.content.fileName) {
				const content = sli.content as VTContent
				// If the fileName is not set...
				if (!content.fileName) {
					newStatus = RunningOrderAPI.LineItemStatusCode.SOURCE_NOT_SET
					message = 'Source is not set'
				} else {
					const mediaObject = MediaObjects.findOne({
						mediaId: content.fileName.toUpperCase()
					})
					// If media object not found, then...
					if (!mediaObject && content.fileName) {
						newStatus = RunningOrderAPI.LineItemStatusCode.SOURCE_MISSING
						message = 'Source is missing: ' + content.fileName
						// All VT content should have at least two streams
					} else if (mediaObject && mediaObject.mediainfo && mediaObject.mediainfo.streams.length < 2) {
						newStatus = RunningOrderAPI.LineItemStatusCode.SOURCE_BROKEN
						message = 'Source doesn\'t have audio & video: ' + content.fileName
					}
					if (mediaObject) {
						if (!newStatus) newStatus = RunningOrderAPI.LineItemStatusCode.OK
						const messages: Array<String> = []

						// Do a format check:
						if (mediaObject.mediainfo) {
							const formats = getAcceptedFormats(config)
							const audioConfig = config.find(item => item._id === 'audioStreams')
							const expectedAudioStreams = audioConfig ? new Set((audioConfig.value + '').split(',').map(v => parseInt(v, 10))) : new Set()

							let timebase
							let audioStreams = 0

							// check the streams for resolution info
							for (const stream of mediaObject.mediainfo.streams) {
								if (stream.width && stream.height) {
									if (stream.codec.time_base) {
										const formattedTimebase = /(\d+)\/(\d+)/.exec(stream.codec.time_base) as RegExpExecArray
										timebase = 1000 * Number(formattedTimebase[1]) / Number(formattedTimebase[2])
									}

									const format = buildFormatString(mediaObject.mediainfo, stream)
									if (!acceptFormat(format, formats)) {
										messages.push(`Source format (${format}) is not in accepted formats`)
									}
								} else if (stream.codec.type === 'audio') {
									audioStreams++
								}
							}

							if (timebase) {
								mediaObject.mediainfo.timebase = timebase
							}

							if (audioConfig && !expectedAudioStreams.has(audioStreams)) {
								messages.push(`Source has ${audioStreams} audio streams`)
							}

							// check for black/freeze frames
							const addFrameWarning = (arr: Array<Anomaly>, type: string) => {
								if (arr.length === 1) {
									const frames = arr[0].duration * 1000 / timebase
									if (arr[0].start === 0) {
										messages.push(`Clip starts with ${frames} ${type} frame${frames > 1 ? 's' : ''}`)
									} else if (arr[0].end === Number(mediaObject.mediainfo!.format.duration)) {
										messages.push(`Clip ends with ${frames} ${type} frame${frames > 1 ? 's' : ''}`)
									} else {
										messages.push(`${frames} ${type} frame${frames > 1 ? 's' : ''} detected in clip.`)
									}
								} else {
									const dur = arr
										.map(b => b.duration)
										.reduce((a, b) => a + b, 0)
									const frames = dur * 1000 / timebase
									messages.push(`${frames} ${type} frame${frames > 1 ? 's' : ''} detected in clip.`)
								}
							}

							if (mediaObject.mediainfo.blacks) {
								addFrameWarning(mediaObject.mediainfo.blacks, 'black')
							}
							if (mediaObject.mediainfo.freezes) {
								addFrameWarning(mediaObject.mediainfo.freezes, 'freeze')
							}
						}

						if (messages.length) {
							if (newStatus === RunningOrderAPI.LineItemStatusCode.OK) {
								newStatus = RunningOrderAPI.LineItemStatusCode.SOURCE_BROKEN
								message = messages.join(', ')
							} else {
								message += ', ' + messages.join(', ')
							}
						}
					}

					if (mediaObject) {
						metadata = mediaObject
					}
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

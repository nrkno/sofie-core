import * as _ from 'underscore'
import {
	VTContent,
	GraphicsContent,
	SourceLayerType,
	ISourceLayer,
	ExpectedPackageStatusAPI,
	PackageInfo,
	LiveSpeakContent,
} from '@sofie-automation/blueprints-integration'
import { MediaObject } from './collections/MediaObjects'
import {
	IStudioSettings,
	MappingExtWithPackage,
	StudioPackageContainer,
	routeExpectedPackages,
} from './collections/Studios'
import { PackageInfoDB } from './collections/PackageInfos'
import { assertNever, Complete, generateTranslation, literal, unprotectString } from './lib'
import { getExpectedPackageId } from './collections/ExpectedPackages'
import { PieceGeneric, PieceStatusCode } from './collections/Pieces'
import { UIStudio } from './api/studios'
import { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { ExpectedPackageId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PackageContainerPackageStatusDB } from './collections/PackageContainerPackageStatus'
import { ReadonlyDeep } from 'type-fest'

/**
 * Take properties from the mediainfo / medistream and transform into a
 * formatted string
 */
export function buildFormatString(
	field_order: PackageInfo.FieldOrder | undefined,
	stream: PieceContentStreamInfo
): string {
	let format = `${stream.width || 0}x${stream.height || 0}`
	switch (field_order) {
		case PackageInfo.FieldOrder.Progressive:
			format += 'p'
			break
		case PackageInfo.FieldOrder.Unknown:
			format += '?'
			break
		default:
			format += 'i'
			break
	}
	if (stream.r_frame_rate) {
		// More accurate method, for package-manager
		const formattedFramerate = /^(\d+)\/(\d+)$/.exec(stream.r_frame_rate) as RegExpExecArray
		let fps = Number(formattedFramerate[1]) / Number(formattedFramerate[2])
		fps = Math.floor(fps * 100 * 100) / 100
		format += fps
	} else if (stream.codec_time_base) {
		// Less accurate method, for media-manager
		const formattedTimebase = /^(\d+)\/(\d+)$/.exec(stream.codec_time_base) as RegExpExecArray
		let fps = Number(formattedTimebase[2]) / Number(formattedTimebase[1])
		fps = Math.floor(fps * 100 * 100) / 100
		format += fps
	}
	switch (field_order) {
		case PackageInfo.FieldOrder.BFF:
			format += 'bff'
			break
		case PackageInfo.FieldOrder.TFF:
			format += 'tff'
			break
		default:
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
export function acceptFormat(format: string, formats: Array<Array<string>>): boolean {
	const match = /((\d+)x(\d+))?((i|p|\?)(\d+))?((tff)|(bff))?/.exec(format)
	if (!match) return false // ingested format string is invalid

	const mediaFormat = match.filter((_o, i) => new Set([2, 3, 5, 6, 7]).has(i))
	for (const candidateFormat of formats) {
		let failed = false
		for (let i = 0; i < candidateFormat.length; i++) {
			if (candidateFormat[i] && candidateFormat[i] !== mediaFormat[i]) {
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
export function getAcceptedFormats(settings: IStudioSettings | undefined): Array<Array<string>> {
	const formatsConfigField = settings ? settings.supportedMediaFormats : ''
	const formatsString: string =
		(formatsConfigField && formatsConfigField !== '' ? formatsConfigField : '1920x1080i5000') + ''
	return _.compact(
		formatsString.split(',').map((res) => {
			const match = /((\d+)x(\d+))?((i|p|\?)(\d+))?((tff)|(bff))?/.exec(res.trim())
			if (match) {
				return match.filter((_o, i) => new Set([2, 3, 5, 6, 7]).has(i))
			} else {
				// specified format string was invalid
				return false
			}
		})
	)
}

export function getMediaObjectMediaId(
	piece: Pick<PieceGeneric, 'content'>,
	sourceLayer: ISourceLayer
): string | undefined {
	switch (sourceLayer.type) {
		case SourceLayerType.VT:
			return (piece.content as VTContent)?.fileName?.toUpperCase()
		case SourceLayerType.LIVE_SPEAK:
			return (piece.content as LiveSpeakContent)?.fileName?.toUpperCase()
		case SourceLayerType.TRANSITION:
			return (piece.content as VTContent)?.fileName?.toUpperCase()
		case SourceLayerType.GRAPHICS:
			return (piece.content as GraphicsContent)?.fileName?.toUpperCase()
	}
	return undefined
}

export interface ScanInfoForPackages {
	[packageId: string]: ScanInfoForPackage
}
export interface ScanInfoForPackage {
	/** Display name of the package  */
	packageName: string
	scan?: PackageInfo.FFProbeScan['payload']
	deepScan?: PackageInfo.FFProbeDeepScan['payload']
	timebase?: number // derived from scan
}

export interface PieceContentStatusObj {
	status: PieceStatusCode
	metadata: MediaObject | null
	packageInfos: ScanInfoForPackages | undefined
	messages: ITranslatableMessage[]
	contentDuration: undefined // TODO - why is this never set?
}

export type PieceContentStatusPiece = Pick<PieceGeneric, '_id' | 'name' | 'content' | 'expectedPackages'>
export type PieceContentStatusStudio = ReadonlyDeep<
	Pick<UIStudio, '_id' | 'settings' | 'packageContainers' | 'mappings' | 'routeSets'>
>

export function checkPieceContentStatus(
	piece: PieceContentStatusPiece,
	sourceLayer: ISourceLayer | undefined,
	studio: PieceContentStatusStudio | undefined,
	getMediaObject: (mediaId: string) => MediaObject | undefined,
	getPackageInfos: (packageId: ExpectedPackageId) => PackageInfoDB[],
	getPackageContainerPackageStatus2: (
		packageContainerId: string,
		expectedPackageId: ExpectedPackageId
	) => Pick<PackageContainerPackageStatusDB, 'status'> | undefined
): PieceContentStatusObj {
	const ignoreMediaStatus = piece.content && piece.content.ignoreMediaObjectStatus
	if (!ignoreMediaStatus && sourceLayer && studio) {
		if (piece.expectedPackages) {
			// Using Expected Packages:
			return checkPieceContentExpectedPackageStatus(
				piece,
				sourceLayer,
				studio,
				getPackageInfos,
				getPackageContainerPackageStatus2
			)
		} else {
			// Fallback to MediaObject statuses:

			return checkPieceContentMediaObjectStatus(piece, sourceLayer, studio, getMediaObject)
		}
	}

	return {
		status: PieceStatusCode.UNKNOWN,
		metadata: null,
		packageInfos: undefined,
		messages: [],
		contentDuration: undefined,
	}
}

function checkPieceContentMediaObjectStatus(
	piece: PieceContentStatusPiece,
	sourceLayer: ISourceLayer,
	studio: PieceContentStatusStudio,
	getMediaObject: (mediaId: string) => MediaObject | undefined
): PieceContentStatusObj {
	let metadata: MediaObject | null = null
	const settings: IStudioSettings | undefined = studio?.settings
	let pieceStatus: PieceStatusCode = PieceStatusCode.UNKNOWN

	const ignoreMediaAudioStatus = piece.content && piece.content.ignoreAudioFormat

	const messages: Array<ContentMessage> = []
	let contentSeemsOK = false
	const fileName = getMediaObjectMediaId(piece, sourceLayer)
	const displayName = piece.name
	switch (sourceLayer.type) {
		case SourceLayerType.VT:
		case SourceLayerType.LIVE_SPEAK:
		case SourceLayerType.TRANSITION:
			// If the fileName is not set...
			if (!fileName) {
				messages.push({
					status: PieceStatusCode.SOURCE_NOT_SET,
					message: generateTranslation('{{sourceLayer}} is missing a file path', {
						sourceLayer: sourceLayer.name,
					}),
				})
			} else {
				const mediaObject = getMediaObject(fileName)
				// If media object not found, then...
				if (!mediaObject) {
					messages.push({
						status: PieceStatusCode.SOURCE_MISSING,
						message: generateTranslation('{{sourceLayer}} is not yet ready on the playout system', {
							sourceLayer: sourceLayer.name,
						}),
					})
					// All VT content should have at least two streams
				} else {
					contentSeemsOK = true

					// Do a format check:
					if (mediaObject.mediainfo) {
						if (mediaObject.mediainfo.streams) {
							const mediainfo = mediaObject.mediainfo
							const timebase = checkStreamFormatsAndCounts(
								messages,
								mediaObject.mediainfo.streams.map((stream) =>
									// Translate to a package-manager type, for code reuse
									literal<Complete<PieceContentStreamInfo>>({
										width: stream.width,
										height: stream.height,
										time_base: stream.time_base,
										codec_type: stream.codec.type,
										codec_time_base: stream.codec.time_base,
										channels: stream.channels,
										r_frame_rate: undefined,
									})
								),
								(stream) => buildFormatString(mediainfo.field_order, stream),
								settings,
								sourceLayer,
								ignoreMediaAudioStatus
							)

							if (timebase) {
								mediaObject.mediainfo.timebase = timebase

								// check for black/freeze frames
								const sourceDuration = piece.content.sourceDuration

								if (!piece.content.ignoreBlackFrames && mediaObject.mediainfo.blacks?.length) {
									addFrameWarning(
										messages,
										timebase,
										sourceDuration,
										mediaObject.mediainfo.format?.duration,
										mediaObject.mediainfo.blacks,
										BlackFrameWarnings
									)
								}
								if (!piece.content.ignoreFreezeFrame && mediaObject.mediainfo.freezes?.length) {
									addFrameWarning(
										messages,
										timebase,
										sourceDuration,
										mediaObject.mediainfo.format?.duration,
										mediaObject.mediainfo.freezes,
										FreezeFrameWarnings
									)
								}
							}
						}
					} else {
						messages.push({
							status: PieceStatusCode.SOURCE_MISSING,
							message: generateTranslation('{{sourceLayer}} is being ingested', {
								sourceLayer: sourceLayer.name,
							}),
						})
					}

					metadata = mediaObject
				}
			}

			break
		case SourceLayerType.GRAPHICS:
			if (fileName) {
				const mediaObject = getMediaObject(fileName)
				if (!mediaObject) {
					messages.push({
						status: PieceStatusCode.SOURCE_MISSING,
						message: generateTranslation('Source is missing', { fileName: displayName }),
					})
				} else {
					contentSeemsOK = true
					metadata = mediaObject
				}
			}
			break
		// Note: If adding another type here, make sure it is also handled in:
		// getMediaObjectMediaId()
		// * withMediaObjectStatus.tsx (updateMediaObjectSubscription)
	}

	if (messages.length) {
		pieceStatus = messages.reduce((prev, msg) => Math.max(prev, msg.status), PieceStatusCode.UNKNOWN)
	} else {
		if (contentSeemsOK) {
			pieceStatus = PieceStatusCode.OK
		}
	}

	return {
		status: pieceStatus,
		metadata: metadata,
		packageInfos: undefined,
		messages: messages.map((msg) => msg.message),
		contentDuration: undefined,
	}
}

interface ContentMessage {
	status: PieceStatusCode
	message: ITranslatableMessage
}

function checkPieceContentExpectedPackageStatus(
	piece: PieceContentStatusPiece,
	sourceLayer: ISourceLayer,
	studio: PieceContentStatusStudio,
	getPackageInfos: (packageId: ExpectedPackageId) => PackageInfoDB[],
	getPackageContainerPackageStatus2: (
		packageContainerId: string,
		expectedPackageId: ExpectedPackageId
	) => Pick<PackageContainerPackageStatusDB, 'status'> | undefined
): PieceContentStatusObj {
	let packageInfoToForward: ScanInfoForPackages | undefined = undefined
	const settings: IStudioSettings | undefined = studio?.settings
	let pieceStatus: PieceStatusCode = PieceStatusCode.UNKNOWN

	const ignoreMediaAudioStatus = piece.content && piece.content.ignoreAudioFormat

	const messages: Array<ContentMessage> = []
	const packageInfos: ScanInfoForPackages = {}
	let readyCount = 0

	if (piece.expectedPackages && piece.expectedPackages.length) {
		// Route the mappings
		const routedMappingsWithPackages = routeExpectedPackages(studio, studio.mappings, piece.expectedPackages)

		const checkedPackageContainers: { [containerId: string]: true } = {}

		for (const mapping of Object.values<MappingExtWithPackage>(routedMappingsWithPackages)) {
			const mappingDeviceId = unprotectString(mapping.deviceId)
			let packageContainerId: string | undefined
			for (const [containerId, packageContainer] of Object.entries<ReadonlyDeep<StudioPackageContainer>>(
				studio.packageContainers
			)) {
				if (packageContainer.deviceIds.includes(mappingDeviceId)) {
					// TODO: how to handle if a device has multiple containers?
					packageContainerId = containerId
					break // just picking the first one found, for now
				}
			}

			if (!packageContainerId) {
				continue
			}
			if (checkedPackageContainers[packageContainerId]) {
				// we have already checked this package container for this expected package
				continue
			}

			checkedPackageContainers[packageContainerId] = true

			for (const expectedPackage of mapping.expectedPackages) {
				const expectedPackageId = getExpectedPackageId(piece._id, expectedPackage._id)
				const packageOnPackageContainer = getPackageContainerPackageStatus2(
					packageContainerId,
					expectedPackageId
				)
				const packageName =
					// @ts-expect-error hack
					expectedPackage.content.filePath ||
					// @ts-expect-error hack
					expectedPackage.content.guid ||
					expectedPackage._id

				const warningMessage = getPackageWarningMessage(packageOnPackageContainer, sourceLayer)
				if (warningMessage) {
					messages.push(warningMessage)
				} else {
					// No warning, must be OK

					readyCount++
					packageInfos[expectedPackage._id] = {
						packageName,
					}
					// Fetch scan-info about the package:
					const dbPackageInfos = getPackageInfos(expectedPackageId)
					for (const packageInfo of dbPackageInfos) {
						if (packageInfo.type === PackageInfo.Type.SCAN) {
							packageInfos[expectedPackage._id].scan = packageInfo.payload
						} else if (packageInfo.type === PackageInfo.Type.DEEPSCAN) {
							packageInfos[expectedPackage._id].deepScan = packageInfo.payload
						}
					}
				}
			}
		}
	}
	if (Object.keys(packageInfos).length) {
		for (const [_packageId, packageInfo] of Object.entries<ScanInfoForPackage>(packageInfos)) {
			const { scan, deepScan } = packageInfo

			if (scan && scan.streams) {
				const timebase = checkStreamFormatsAndCounts(
					messages,
					scan.streams,
					(stream) => (deepScan ? buildFormatString(deepScan.field_order, stream) : null),
					settings,
					sourceLayer,
					ignoreMediaAudioStatus
				)
				if (timebase) {
					packageInfo.timebase = timebase // what todo?

					// check for black/freeze frames

					const sourceDuration = piece.content.sourceDuration

					if (!piece.content.ignoreBlackFrames && deepScan?.blacks?.length) {
						addFrameWarning(
							messages,
							timebase,
							sourceDuration,
							scan.format?.duration,
							deepScan.blacks,
							BlackFrameWarnings
						)
					}
					if (!piece.content.ignoreFreezeFrame && deepScan?.freezes?.length) {
						addFrameWarning(
							messages,
							timebase,
							sourceDuration,
							scan.format?.duration,
							deepScan.freezes,
							FreezeFrameWarnings
						)
					}
				}
			}
		}

		packageInfoToForward = packageInfos
	}
	if (messages.length) {
		pieceStatus = messages.reduce((prev, msg) => Math.max(prev, msg.status), PieceStatusCode.UNKNOWN)
	} else {
		if (readyCount > 0) {
			pieceStatus = PieceStatusCode.OK
		}
	}

	return {
		status: pieceStatus,
		metadata: null,
		packageInfos: packageInfoToForward,
		messages: messages.map((msg) => msg.message),
		contentDuration: undefined,
	}
}

function getPackageWarningMessage(
	packageOnPackageContainer: Pick<PackageContainerPackageStatusDB, 'status'> | undefined,
	sourceLayer: ISourceLayer
): ContentMessage | null {
	if (
		!packageOnPackageContainer ||
		packageOnPackageContainer.status.status ===
			ExpectedPackageStatusAPI.PackageContainerPackageStatusStatus.NOT_FOUND
	) {
		// Examples of contents in packageOnPackageContainer?.status.statusReason.user:
		// * Target package: Quantel clip "XXX" not found
		// * Can't read the Package from PackageContainer "Quantel source 0" (on accessor "${accessorLabel}"), due to: Quantel clip "XXX" not found

		return {
			status: PieceStatusCode.SOURCE_MISSING,
			message: generateTranslation(`{{sourceLayer}} can't be found on the playout system`, {
				sourceLayer: sourceLayer.name,
			}),
		}
	} else if (
		packageOnPackageContainer.status.status ===
		ExpectedPackageStatusAPI.PackageContainerPackageStatusStatus.NOT_READY
	) {
		// Examples of contents in packageOnPackageContainer?.status.statusReason.user:
		// * Source file is still growing

		return {
			status: PieceStatusCode.SOURCE_MISSING,
			message: generateTranslation(
				'{{reason}} {{sourceLayer}} exists, but is not yet ready on the playout system',
				{
					reason: ((packageOnPackageContainer?.status.statusReason.user || 'N/A') + '.').replace(
						/\.\.$/,
						'.'
					), // remove any trailing double "."
					sourceLayer: sourceLayer.name,
				}
			),
		}
	} else if (
		// Examples of contents in packageOnPackageContainer?.status.statusReason.user:
		// * Reserved clip (0 frames)
		// * Reserved clip (1-9 frames)
		packageOnPackageContainer.status.status ===
		ExpectedPackageStatusAPI.PackageContainerPackageStatusStatus.PLACEHOLDER
	) {
		return {
			status: PieceStatusCode.SOURCE_NOT_READY,
			message: packageOnPackageContainer?.status.statusReason.user
				? {
						// remove any trailing double "."
						key: (packageOnPackageContainer?.status.statusReason.user + '.').replace(/\.\.$/, '.'),
				  }
				: generateTranslation(
						'{{sourceLayer}} is in a placeholder state for an unknown workflow-defined reason',
						{
							sourceLayer: sourceLayer.name,
						}
				  ),
		}
	} else if (
		packageOnPackageContainer.status.status ===
		ExpectedPackageStatusAPI.PackageContainerPackageStatusStatus.TRANSFERRING_READY
	) {
		return {
			status: PieceStatusCode.OK,
			message: generateTranslation('{{sourceLayer}} is transferring to the playout system', {
				sourceLayer: sourceLayer.name,
			}),
		}
	} else if (
		packageOnPackageContainer.status.status ===
		ExpectedPackageStatusAPI.PackageContainerPackageStatusStatus.TRANSFERRING_NOT_READY
	) {
		return {
			status: PieceStatusCode.SOURCE_MISSING,
			message: generateTranslation(
				'{{sourceLayer}} is transferring to the playout system but cannot be played yet',
				{
					sourceLayer: sourceLayer.name,
				}
			),
		}
	} else if (
		packageOnPackageContainer.status.status === ExpectedPackageStatusAPI.PackageContainerPackageStatusStatus.READY
	) {
		return null
	} else {
		assertNever(packageOnPackageContainer.status.status)
		return {
			status: PieceStatusCode.UNKNOWN,
			message: generateTranslation('{{sourceLayer}} is in an unknown state', {
				sourceLayer: sourceLayer.name,
			}),
		}
	}
}

export type PieceContentStreamInfo = Pick<
	PackageInfo.FFProbeScanStream,
	'width' | 'height' | 'time_base' | 'codec_type' | 'codec_time_base' | 'channels' | 'r_frame_rate'
>
function checkStreamFormatsAndCounts(
	messages: Array<ContentMessage>,
	streams: PieceContentStreamInfo[],
	getScanFormatString: (stream: PieceContentStreamInfo) => string | null,
	studioSettings: IStudioSettings | undefined,
	sourceLayer: ISourceLayer,
	ignoreMediaAudioStatus: boolean | undefined
): number {
	if (!ignoreMediaAudioStatus && streams.length < 2) {
		messages.push({
			status: PieceStatusCode.SOURCE_BROKEN,
			message: generateTranslation("{{sourceLayer}} doesn't have both audio & video", {
				sourceLayer: sourceLayer.name,
			}),
		})
	}
	const formats = getAcceptedFormats(studioSettings)
	const audioConfig = studioSettings ? studioSettings.supportedAudioStreams : ''
	const expectedAudioStreams = audioConfig
		? new Set<string>(audioConfig.split(',').map((v) => v.trim()))
		: new Set<string>()

	let timebase: number = 0
	let audioStreams: number = 0
	let isStereo: boolean = false

	// check the streams for resolution info
	for (const stream of streams) {
		if (stream.width && stream.height) {
			if (stream.codec_time_base) {
				const formattedTimebase = /^(\d+)\/(\d+)$/.exec(stream.codec_time_base) as RegExpExecArray
				timebase = (1000 * Number(formattedTimebase[1])) / Number(formattedTimebase[2]) || 0
			}

			const deepScanFormat = getScanFormatString(stream)
			if (deepScanFormat) {
				if (!acceptFormat(deepScanFormat, formats)) {
					messages.push({
						status: PieceStatusCode.SOURCE_BROKEN,
						message: generateTranslation('{{sourceLayer}} has the wrong format: {{format}}', {
							sourceLayer: sourceLayer.name,
							format: deepScanFormat,
						}),
					})
				}
			}
		} else if (stream.codec_type === 'audio') {
			// this is the first (and hopefully last) track of audio, and has 2 channels
			if (audioStreams === 0 && stream.channels === 2) {
				isStereo = true
			}
			audioStreams++
		}
	}
	if (
		!ignoreMediaAudioStatus &&
		audioConfig &&
		(!expectedAudioStreams.has(audioStreams.toString()) || (isStereo && !expectedAudioStreams.has('stereo')))
	) {
		messages.push({
			status: PieceStatusCode.SOURCE_BROKEN,
			message: generateTranslation('{{sourceLayer}} has {{audioStreams}} audio streams', {
				sourceLayer: sourceLayer.name,
				audioStreams,
			}),
		})
	}

	return timebase
}

function addFrameWarning(
	messages: Array<ContentMessage>,
	timebase: number,
	sourceDuration: number | undefined,
	scannedFormatDuration: number | string | undefined,
	anomalies: Array<PackageInfo.Anomaly>,
	strings: FrameWarningStrings
): void {
	if (anomalies.length === 1) {
		/** Number of frames */
		const frames = Math.ceil((anomalies[0].duration * 1000) / timebase)
		if (anomalies[0].start === 0) {
			messages.push({
				status: PieceStatusCode.SOURCE_HAS_ISSUES,
				message: generateTranslation(strings.clipStartsWithCount, {
					frames,
				}),
			})
		} else if (
			scannedFormatDuration &&
			anomalies[0].end === Number(scannedFormatDuration) &&
			(sourceDuration === undefined || Math.round(anomalies[0].start) * 1000 < sourceDuration)
		) {
			const freezeStartsAt = Math.round(anomalies[0].start)
			messages.push({
				status: PieceStatusCode.SOURCE_HAS_ISSUES,
				message: generateTranslation(strings.clipEndsWithAfter, {
					seconds: freezeStartsAt,
				}),
			})
		} else if (frames > 0) {
			messages.push({
				status: PieceStatusCode.SOURCE_HAS_ISSUES,
				message: generateTranslation(strings.countDetectedWithinClip, {
					frames,
				}),
			})
		}
	} else if (anomalies.length > 0) {
		const dur = anomalies
			.filter((a) => sourceDuration === undefined || a.start * 1000 < sourceDuration)
			.map((b) => b.duration)
			.reduce((a, b) => a + b, 0)
		const frames = Math.ceil((dur * 1000) / timebase)
		if (frames > 0) {
			messages.push({
				status: PieceStatusCode.SOURCE_HAS_ISSUES,
				message: generateTranslation(strings.countDetectedInClip, {
					frames,
				}),
			})
		}
	}
}

interface FrameWarningStrings {
	clipStartsWithCount: string
	clipEndsWithAfter: string
	countDetectedWithinClip: string
	countDetectedInClip: string
}

// Mock 't' function for i18next to find the keys
function t(key: string): string {
	return key
}

const BlackFrameWarnings: FrameWarningStrings = {
	clipStartsWithCount: t('Clip starts with {{frames}} black frames'),
	clipEndsWithAfter: t('This clip ends with black frames after {{seconds}} seconds'),
	countDetectedWithinClip: t('{{frames}} black frames detected within the clip'),
	countDetectedInClip: t('{{frames}} black frames detected in the clip'),
}

const FreezeFrameWarnings: FrameWarningStrings = {
	clipStartsWithCount: t('Clip starts with {{frames}} freeze frames'),
	clipEndsWithAfter: t('This clip ends with freeze frames after {{seconds}} seconds'),
	countDetectedWithinClip: t('{{frames}} freeze frames detected within the clip'),
	countDetectedInClip: t('{{frames}} freeze frames detected in the clip'),
}

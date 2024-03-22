import {
	Accessor,
	ExpectedPackage,
	ExpectedPackageStatusAPI,
	GraphicsContent,
	ISourceLayer,
	ITranslatableMessage,
	LiveSpeakContent,
	PackageInfo,
	SourceLayerType,
	VTContent,
} from '@sofie-automation/blueprints-integration'
import { getExpectedPackageId } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { ExpectedPackageId, PeripheralDeviceId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	getPackageContainerPackageId,
	PackageContainerPackageStatusDB,
} from '@sofie-automation/corelib/dist/dataModel/PackageContainerPackageStatus'
import { PieceGeneric, PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import {
	DBStudio,
	IStudioSettings,
	MappingExt,
	MappingsExt,
	ResultingMappingRoutes,
	StudioPackageContainer,
} from '@sofie-automation/corelib/dist/dataModel/Studio'
import { literal, Complete, assertNever } from '@sofie-automation/corelib/dist/lib'
import { ReadonlyDeep } from 'type-fest'
import _ from 'underscore'
import { getSideEffect } from '../../../lib/collections/ExpectedPackages'
import { getActiveRoutes, getRoutedMappings } from '../../../lib/collections/Studios'
import { ensureHasTrailingSlash, generateTranslation, unprotectString } from '../../../lib/lib'
import { PieceContentStatusObj } from '../../../lib/api/pieceContentStatus'
import { MediaObjects, PackageContainerPackageStatuses, PackageInfos } from '../../collections'
import {
	mediaObjectFieldSpecifier,
	MediaObjectLight,
	packageContainerPackageStatusesFieldSpecifier,
	PackageContainerPackageStatusLight,
	packageInfoFieldSpecifier,
	PackageInfoLight,
	PieceDependencies,
} from './common'

interface ScanInfoForPackages {
	[packageId: string]: ScanInfoForPackage
}
interface ScanInfoForPackage {
	/** Display name of the package  */
	packageName: string
	scan?: PackageInfo.FFProbeScan['payload']
	deepScan?: PackageInfo.FFProbeDeepScan['payload']
	timebase?: number // derived from scan
}

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

export type PieceContentStatusPiece = Pick<PieceGeneric, '_id' | 'content' | 'expectedPackages'> & {
	pieceInstanceId?: PieceInstanceId
}
export interface PieceContentStatusStudio
	extends Pick<
		DBStudio,
		'_id' | 'settings' | 'packageContainers' | 'previewContainerIds' | 'thumbnailContainerIds' | 'routeSets'
	> {
	/** Mappings between the physical devices / outputs and logical ones */
	mappings: MappingsExt
}

export async function checkPieceContentStatusAndDependencies(
	studio: PieceContentStatusStudio,
	piece: PieceContentStatusPiece,
	sourceLayer: ISourceLayer
): Promise<[status: PieceContentStatusObj, pieceDependencies: PieceDependencies]> {
	const pieceDependencies: PieceDependencies = {
		mediaObjects: [],
		packageInfos: [],
		packageContainerPackageStatuses: [],
	}

	const ignoreMediaStatus = piece.content && piece.content.ignoreMediaObjectStatus
	if (!ignoreMediaStatus) {
		if (piece.expectedPackages) {
			const getPackageInfos = async (packageId: ExpectedPackageId) => {
				pieceDependencies.packageInfos.push(packageId)
				return PackageInfos.findFetchAsync(
					{
						studioId: studio._id,
						packageId: packageId,
						type: {
							$in: [PackageInfo.Type.SCAN, PackageInfo.Type.DEEPSCAN],
						},
					},
					{
						projection: packageInfoFieldSpecifier,
					}
				) as Promise<PackageInfoLight[]>
			}

			const getPackageContainerPackageStatus = async (
				packageContainerId: string,
				expectedPackageId: ExpectedPackageId
			) => {
				const id = getPackageContainerPackageId(studio._id, packageContainerId, expectedPackageId)
				pieceDependencies.packageContainerPackageStatuses.push(id)
				return PackageContainerPackageStatuses.findOneAsync(
					{
						_id: id,
						studioId: studio._id,
					},
					{ projection: packageContainerPackageStatusesFieldSpecifier }
				) as Promise<PackageContainerPackageStatusLight | undefined>
			}

			// Using Expected Packages:
			const status = await checkPieceContentExpectedPackageStatus(
				piece,
				sourceLayer,
				studio,
				getPackageInfos,
				getPackageContainerPackageStatus
			)
			return [status, pieceDependencies]
		} else {
			// Fallback to MediaObject statuses:
			const getMediaObject = async (mediaId: string) => {
				pieceDependencies.mediaObjects.push(mediaId)
				return MediaObjects.findOneAsync(
					{
						studioId: studio._id,
						mediaId,
					},
					{ projection: mediaObjectFieldSpecifier }
				) as Promise<MediaObjectLight | undefined>
			}

			const status = await checkPieceContentMediaObjectStatus(piece, sourceLayer, studio, getMediaObject)
			return [status, pieceDependencies]
		}
	}

	return [
		{
			status: PieceStatusCode.UNKNOWN,
			messages: [],
			progress: undefined,

			freezes: [],
			blacks: [],
			scenes: [],

			thumbnailUrl: undefined,
			previewUrl: undefined,

			packageName: null,
			contentDuration: undefined,
		},
		pieceDependencies,
	]
}

async function checkPieceContentMediaObjectStatus(
	piece: PieceContentStatusPiece,
	sourceLayer: ISourceLayer,
	studio: PieceContentStatusStudio,
	getMediaObject: (mediaId: string) => Promise<MediaObjectLight | undefined>
): Promise<PieceContentStatusObj> {
	let metadata: MediaObjectLight | null = null
	const settings: IStudioSettings | undefined = studio?.settings
	let pieceStatus: PieceStatusCode = PieceStatusCode.UNKNOWN

	const ignoreMediaAudioStatus = piece.content && piece.content.ignoreAudioFormat

	let freezes: Array<PackageInfo.Anomaly> = []
	let blacks: Array<PackageInfo.Anomaly> = []
	let scenes: Array<number> = []

	const messages: Array<ContentMessage> = []
	let contentSeemsOK = false
	const fileName = getMediaObjectMediaId(piece, sourceLayer)
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
				const mediaObject = await getMediaObject(fileName)
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

								if (mediaObject.mediainfo.blacks?.length) {
									if (!piece.content.ignoreBlackFrames) {
										addFrameWarning(
											messages,
											timebase,
											sourceDuration,
											mediaObject.mediainfo.format?.duration,
											mediaObject.mediainfo.blacks,
											BlackFrameWarnings
										)
									}

									blacks = mediaObject.mediainfo.blacks.map((i): PackageInfo.Anomaly => {
										return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 }
									})
								}
								if (mediaObject.mediainfo.freezes?.length) {
									if (!piece.content.ignoreFreezeFrame) {
										addFrameWarning(
											messages,
											timebase,
											sourceDuration,
											mediaObject.mediainfo.format?.duration,
											mediaObject.mediainfo.freezes,
											FreezeFrameWarnings
										)
									}

									freezes = mediaObject.mediainfo.freezes.map((i): PackageInfo.Anomaly => {
										return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 }
									})
								}

								if (mediaObject.mediainfo.scenes) {
									scenes = _.compact(mediaObject.mediainfo.scenes.map((i) => i * 1000)) // convert into milliseconds
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
				const mediaObject = await getMediaObject(fileName)
				if (!mediaObject) {
					messages.push({
						status: PieceStatusCode.SOURCE_MISSING,
						message: generateTranslation('{{sourceLayer}} is missing', { sourceLayer: sourceLayer.name }),
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

	let contentDuration: number | null | undefined = undefined
	if (metadata?.mediainfo?.streams?.length) {
		const maximumStreamDuration = metadata.mediainfo.streams.reduce(
			(prev, current) =>
				current.duration !== undefined ? Math.max(prev, Number.parseFloat(current.duration)) : prev,
			Number.NaN
		)
		contentDuration = Number.isFinite(maximumStreamDuration) ? maximumStreamDuration : undefined
	}

	return {
		status: pieceStatus,
		messages: messages.map((msg) => msg.message),
		progress: 0,

		freezes,
		blacks,
		scenes,

		thumbnailUrl: metadata
			? getAssetUrlFromContentMetaData(metadata, 'thumbnail', studio.settings.mediaPreviewsUrl)
			: undefined,
		previewUrl: metadata
			? getAssetUrlFromContentMetaData(metadata, 'preview', studio.settings.mediaPreviewsUrl)
			: undefined,

		packageName: metadata?.mediaId || null,

		contentDuration,
	}
}

function getAssetUrlFromContentMetaData(
	contentMetaData: MediaObjectLight,
	assetType: 'thumbnail' | 'preview',
	mediaPreviewUrl: string
): string | undefined {
	if (!contentMetaData || !contentMetaData.previewPath) return
	return (
		ensureHasTrailingSlash(mediaPreviewUrl ?? null) +
		`media/${assetType}/` +
		encodeURIComponent(contentMetaData.mediaId)
	)
}

interface ContentMessage {
	status: PieceStatusCode
	message: ITranslatableMessage
}

async function checkPieceContentExpectedPackageStatus(
	piece: PieceContentStatusPiece,
	sourceLayer: ISourceLayer,
	studio: PieceContentStatusStudio,
	getPackageInfos: (packageId: ExpectedPackageId) => Promise<PackageInfoLight[]>,
	getPackageContainerPackageStatus: (
		packageContainerId: string,
		expectedPackageId: ExpectedPackageId
	) => Promise<PackageContainerPackageStatusLight | undefined>
): Promise<PieceContentStatusObj> {
	const settings: IStudioSettings | undefined = studio?.settings
	let pieceStatus: PieceStatusCode = PieceStatusCode.UNKNOWN

	const ignoreMediaAudioStatus = piece.content && piece.content.ignoreAudioFormat

	const messages: Array<ContentMessage> = []
	const packageInfos: ScanInfoForPackages = {}
	let readyCount = 0

	let freezes: Array<PackageInfo.Anomaly> = []
	let blacks: Array<PackageInfo.Anomaly> = []
	let scenes: Array<number> = []
	let packageName: string | null = null

	let thumbnailUrl: string | undefined
	let previewUrl: string | undefined
	let progress: number | undefined

	if (piece.expectedPackages && piece.expectedPackages.length) {
		const routes = getActiveRoutes(studio.routeSets)

		for (const expectedPackage of piece.expectedPackages) {
			// Route the mappings
			const routedDeviceIds = routeExpectedPackage(routes, studio.mappings, expectedPackage)

			const checkedPackageContainers = new Set<string>()

			for (const routedDeviceId of routedDeviceIds) {
				let packageContainerId: string | undefined
				for (const [containerId, packageContainer] of Object.entries<ReadonlyDeep<StudioPackageContainer>>(
					studio.packageContainers
				)) {
					if (packageContainer.deviceIds.includes(unprotectString(routedDeviceId))) {
						// TODO: how to handle if a device has multiple containers?
						packageContainerId = containerId
						break // just picking the first one found, for now
					}
				}

				if (!packageContainerId) {
					continue
				}

				if (checkedPackageContainers.has(packageContainerId)) {
					// we have already checked this package container for this expected package
					continue
				}

				checkedPackageContainers.add(packageContainerId)

				const expectedPackageIds = [getExpectedPackageId(piece._id, expectedPackage._id)]
				if (piece.pieceInstanceId) {
					// If this is a PieceInstance, try looking up the PieceInstance first
					expectedPackageIds.unshift(getExpectedPackageId(piece.pieceInstanceId, expectedPackage._id))
				}

				let warningMessage: ContentMessage | null = null
				let matchedExpectedPackageId: ExpectedPackageId | null = null
				for (const expectedPackageId of expectedPackageIds) {
					const packageOnPackageContainer = await getPackageContainerPackageStatus(
						packageContainerId,
						expectedPackageId
					)
					if (!packageOnPackageContainer) continue

					matchedExpectedPackageId = expectedPackageId

					if (!thumbnailUrl) {
						const sideEffect = getSideEffect(expectedPackage, studio)

						thumbnailUrl = await getAssetUrlFromPackageContainerStatus(
							studio,
							getPackageContainerPackageStatus,
							expectedPackageId,
							sideEffect.thumbnailContainerId,
							sideEffect.thumbnailPackageSettings?.path
						)
					}

					if (!previewUrl) {
						const sideEffect = getSideEffect(expectedPackage, studio)

						previewUrl = await getAssetUrlFromPackageContainerStatus(
							studio,
							getPackageContainerPackageStatus,
							expectedPackageId,
							sideEffect.previewContainerId,
							sideEffect.previewPackageSettings?.path
						)
					}

					warningMessage = getPackageWarningMessage(packageOnPackageContainer, sourceLayer)

					progress = getPackageProgress(packageOnPackageContainer) ?? undefined

					// Found a packageOnPackageContainer
					break
				}

				if (!matchedExpectedPackageId || warningMessage) {
					// If no package matched, we must have a warning
					messages.push(warningMessage ?? getPackageSoruceMissingWarning(sourceLayer))
				} else {
					// No warning, must be OK

					const packageName =
						// @ts-expect-error hack
						expectedPackage.content.filePath ||
						// @ts-expect-error hack
						expectedPackage.content.guid ||
						expectedPackage._id

					readyCount++
					packageInfos[expectedPackage._id] = {
						packageName,
					}
					// Fetch scan-info about the package:
					const dbPackageInfos = await getPackageInfos(matchedExpectedPackageId)
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

	const firstPackage = Object.values<ScanInfoForPackage>(packageInfos)[0]
	let contentDuration: number | null | undefined = undefined
	if (firstPackage) {
		// TODO: support multiple packages:
		if (!piece.content.ignoreFreezeFrame && firstPackage.deepScan?.freezes?.length) {
			freezes = firstPackage.deepScan.freezes.map((i): PackageInfo.Anomaly => {
				return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 }
			})
		}
		if (!piece.content.ignoreBlackFrames && firstPackage.deepScan?.blacks?.length) {
			blacks = firstPackage.deepScan.blacks.map((i): PackageInfo.Anomaly => {
				return { start: i.start * 1000, end: i.end * 1000, duration: i.duration * 1000 }
			})
		}
		if (firstPackage.deepScan?.scenes) {
			scenes = _.compact(firstPackage.deepScan.scenes.map((i) => i * 1000)) // convert into milliseconds
		}

		if (firstPackage.scan?.streams?.length) {
			const maximumStreamDuration = firstPackage.scan.streams.reduce(
				(prev, current) =>
					current.duration !== undefined ? Math.max(prev, Number.parseFloat(current.duration)) : prev,
				Number.NaN
			)
			contentDuration = Number.isFinite(maximumStreamDuration) ? maximumStreamDuration : undefined
		}

		packageName = firstPackage.packageName
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
		messages: messages.map((msg) => msg.message),
		progress,

		freezes,
		blacks,
		scenes,

		thumbnailUrl,
		previewUrl,

		packageName,

		contentDuration,
	}
}

async function getAssetUrlFromPackageContainerStatus(
	studio: PieceContentStatusStudio,
	getPackageContainerPackageStatus: (
		packageContainerId: string,
		expectedPackageId: ExpectedPackageId
	) => Promise<PackageContainerPackageStatusLight | undefined>,
	expectedPackageId: ExpectedPackageId,
	assetContainerId: string | null | undefined,
	packageAssetPath: string | undefined
): Promise<string | undefined> {
	if (!assetContainerId || !packageAssetPath) return

	const assetPackageContainer = studio.packageContainers[assetContainerId]
	if (!assetPackageContainer) return

	const previewPackageOnPackageContainer = await getPackageContainerPackageStatus(assetContainerId, expectedPackageId)
	if (!previewPackageOnPackageContainer) return

	return getAssetUrlFromExpectedPackages(packageAssetPath, assetPackageContainer, previewPackageOnPackageContainer)
}

function getAssetUrlFromExpectedPackages(
	assetPath: string,
	packageContainer: StudioPackageContainer,
	packageOnPackageContainer: Pick<PackageContainerPackageStatusDB, 'status'>
): string | undefined {
	if (packageOnPackageContainer.status.status !== ExpectedPackageStatusAPI.PackageContainerPackageStatusStatus.READY)
		return

	// Look up an accessor we can use:
	for (const accessor of Object.values<Accessor.Any>(packageContainer.container.accessors)) {
		if (
			(accessor.type === Accessor.AccessType.HTTP || accessor.type === Accessor.AccessType.HTTP_PROXY) &&
			accessor.baseUrl
		) {
			// Currently we only support public accessors (ie has no networkId set)
			if (!accessor.networkId) {
				return [
					accessor.baseUrl.replace(/\/$/, ''), // trim trailing slash
					encodeURIComponent(
						assetPath.replace(/^\//, '') // trim leading slash
					),
				].join('/')
			}
		}
	}
}

function getPackageProgress(
	packageOnPackageContainer: Pick<PackageContainerPackageStatusDB, 'status'> | undefined
): number | null {
	return packageOnPackageContainer?.status.progress ?? null
}

function getPackageSoruceMissingWarning(sourceLayer: ISourceLayer): ContentMessage {
	// Examples of contents in packageOnPackageContainer?.status.statusReason.user:
	// * Target package: Quantel clip "XXX" not found
	// * Can't read the Package from PackageContainer "Quantel source 0" (on accessor "${accessorLabel}"), due to: Quantel clip "XXX" not found

	return {
		status: PieceStatusCode.SOURCE_MISSING,
		message: generateTranslation(`{{sourceLayer}} can't be found on the playout system`, {
			sourceLayer: sourceLayer.name,
		}),
	}
}

function getPackageWarningMessage(
	packageOnPackageContainer: Pick<PackageContainerPackageStatusDB, 'status'>,
	sourceLayer: ISourceLayer
): ContentMessage | null {
	if (
		packageOnPackageContainer.status.status ===
		ExpectedPackageStatusAPI.PackageContainerPackageStatusStatus.NOT_FOUND
	) {
		return getPackageSoruceMissingWarning(sourceLayer)
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
			status: PieceStatusCode.SOURCE_UNKNOWN_STATE,
			message: generateTranslation('{{sourceLayer}} is in an unknown state: "{{status}}"', {
				sourceLayer: sourceLayer.name,
				status: packageOnPackageContainer.status.status,
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
	if (!ignoreMediaAudioStatus && streams.length < 2 && sourceLayer.type !== SourceLayerType.AUDIO) {
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

	let timebase = 0
	let audioStreams = 0
	let isStereo = false

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

function routeExpectedPackage(
	routes: ResultingMappingRoutes,
	studioMappings: ReadonlyDeep<MappingsExt>,
	expectedPackage: ExpectedPackage.Base
): Set<PeripheralDeviceId> {
	// Collect the relevant mappings
	const mappingsWithPackages: MappingsExt = {}
	for (const layerName of expectedPackage.layers) {
		const mapping = studioMappings[layerName]

		if (mapping) {
			if (!mappingsWithPackages[layerName]) {
				mappingsWithPackages[layerName] = mapping
			}
		}
	}

	// Route the mappings
	const routedMappings = getRoutedMappings(mappingsWithPackages, routes)

	// Find the referenced deviceIds
	return new Set(Object.values<MappingExt>(routedMappings).map((mapping) => mapping.deviceId))
}

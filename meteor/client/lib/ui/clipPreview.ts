import { Accessor, ExpectedPackage, ExpectedPackageStatusAPI } from '@sofie-automation/blueprints-integration'
import { getPackageContainerPackageStatus } from '../../utils/globalStores'
import { PieceUi } from '../../ui/SegmentContainer/withResolvedSegment'
import { ensureHasTrailingSlash } from '../lib'
import { AdLibPieceUi } from '../shelf'
import { getExpectedPackageId, getSideEffect } from '../../../lib/collections/ExpectedPackages'
import { MediaObject } from '../../../lib/collections/MediaObjects'
import { UIStudio } from '../../../lib/api/studios'
import {
	AdLibActionId,
	PieceId,
	RundownBaselineAdLibActionId,
	RundownId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'

type OwnerId = PieceId | AdLibActionId | RundownBaselineAdLibActionId | RundownId | StudioId

function getAssetUrlFromExpectedPackages(
	ownerId: OwnerId,
	assetPath: string,
	assetContainerId: string,
	expectedPackage: ExpectedPackage.Any,
	studio: UIStudio
): string | undefined {
	const packageContainer = studio.packageContainers[assetContainerId]
	if (!packageContainer) return

	const packageOnPackageContainer = getPackageContainerPackageStatus(
		studio._id,
		assetContainerId,
		getExpectedPackageId(ownerId, expectedPackage._id)
	)
	if (!packageOnPackageContainer) return
	if (packageOnPackageContainer.status.status !== ExpectedPackageStatusAPI.PackageContainerPackageStatusStatus.READY)
		return

	// Look up an accessor we can use:
	for (const accessor of Object.values(packageContainer.container.accessors)) {
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

function getPreviewUrlFromExpectedPackages(
	ownerId: OwnerId,
	expectedPackages: ExpectedPackage.Any[],
	studio: UIStudio
): string | undefined {
	// use Expected packages:
	// Just use the first one we find.
	// TODO: support multiple expected packages?

	let previewContainerId: string | undefined
	let packagePreviewPath: string | undefined
	let expectedPackage: ExpectedPackage.Any | undefined
	for (const expPackage of expectedPackages) {
		const sideEffect = getSideEffect(expPackage, studio)

		packagePreviewPath = sideEffect.previewPackageSettings?.path
		previewContainerId = sideEffect.previewContainerId ?? undefined
		expectedPackage = expPackage

		if (packagePreviewPath && previewContainerId) {
			break // don't look further
		}
	}
	if (!packagePreviewPath || !previewContainerId || !expectedPackage) return
	return getAssetUrlFromExpectedPackages(ownerId, packagePreviewPath, previewContainerId, expectedPackage, studio)
}

function getThumbnailUrlFromExpectedPackages(
	ownerId: PieceId | AdLibActionId | RundownBaselineAdLibActionId | RundownId | StudioId,
	expectedPackages: ExpectedPackage.Any[],
	studio: UIStudio
): string | undefined {
	// use Expected packages:
	// Just use the first one we find.
	// TODO: support multiple expected packages?

	let thumbnailContainerId: string | undefined
	let packageThumbnailPath: string | undefined
	let expectedPackage: ExpectedPackage.Any | undefined
	for (const expPackage of expectedPackages) {
		const sideEffect = getSideEffect(expPackage, studio)

		packageThumbnailPath = sideEffect.thumbnailPackageSettings?.path
		thumbnailContainerId = sideEffect.thumbnailContainerId ?? undefined
		expectedPackage = expPackage

		if (packageThumbnailPath && thumbnailContainerId) {
			break // don't look further
		}
	}
	if (!packageThumbnailPath || !thumbnailContainerId || !expectedPackage) return
	return getAssetUrlFromExpectedPackages(ownerId, packageThumbnailPath, thumbnailContainerId, expectedPackage, studio)
}

function getAssetUrlFromContentMetaData(
	contentMetaData: MediaObject,
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

function getThumbnailUrlFromContentMetaData(contentMetaData: MediaObject, mediaPreviewUrl: string): string | undefined {
	return getAssetUrlFromContentMetaData(contentMetaData, 'thumbnail', mediaPreviewUrl)
}

function getPreviewUrlFromContentMetaData(contentMetaData: MediaObject, mediaPreviewUrl: string): string | undefined {
	return getAssetUrlFromContentMetaData(contentMetaData, 'preview', mediaPreviewUrl)
}

export function getThumbnailUrlForAdLibPieceUi(
	piece: AdLibPieceUi,
	studio: UIStudio,
	mediaPreviewUrl: string | undefined
): string | undefined {
	if (piece.expectedPackages) {
		return getThumbnailUrlFromExpectedPackages(piece._id, piece.expectedPackages, studio)
	} else if (mediaPreviewUrl && piece.contentMetaData) {
		// Fallback to media objects
		return getThumbnailUrlFromContentMetaData(piece.contentMetaData, mediaPreviewUrl)
	}
	return undefined
}

export function getThumbnailUrlForPieceUi(
	pieceInstance: PieceUi,
	studio: UIStudio,
	mediaPreviewUrl: string | undefined
): string | undefined {
	const piece = pieceInstance.instance.piece
	if (piece.expectedPackages) {
		return getThumbnailUrlFromExpectedPackages(piece._id, piece.expectedPackages, studio)
	} else if (mediaPreviewUrl && pieceInstance.contentMetaData) {
		// Fallback to media objects
		return getThumbnailUrlFromContentMetaData(pieceInstance.contentMetaData, mediaPreviewUrl)
	}
	return undefined
}

export function getPreviewUrlForAdLibPieceUi(
	piece: AdLibPieceUi,
	studio: UIStudio,
	mediaPreviewUrl: string | undefined
): string | undefined {
	if (piece.expectedPackages) {
		return getPreviewUrlFromExpectedPackages(piece._id, piece.expectedPackages, studio)
	} else if (mediaPreviewUrl && piece.contentMetaData) {
		// Fallback to media objects
		return getPreviewUrlFromContentMetaData(piece.contentMetaData, mediaPreviewUrl)
	}
	return undefined
}

export function getPreviewUrlForPieceUi(
	pieceInstance: PieceUi,
	studio: UIStudio,
	mediaPreviewUrl: string | undefined
): string | undefined {
	const piece = pieceInstance.instance.piece
	if (piece.expectedPackages) {
		return getPreviewUrlFromExpectedPackages(piece._id, piece.expectedPackages, studio)
	} else if (mediaPreviewUrl && pieceInstance.contentMetaData) {
		// Fallback to media objects
		return getPreviewUrlFromContentMetaData(pieceInstance.contentMetaData, mediaPreviewUrl)
	}
	return undefined
}

export function getPreviewUrlForExpectedPackagesAndContentMetaData(
	ownerId: OwnerId,
	studio: UIStudio | undefined,
	mediaPreviewUrl: string | undefined,
	expectedPackages: ExpectedPackage.Any[] | undefined,
	contentMetaData: MediaObject | null | undefined
): string | undefined {
	if (studio && expectedPackages) {
		return getPreviewUrlFromExpectedPackages(ownerId, expectedPackages, studio)
	} else if (mediaPreviewUrl && contentMetaData) {
		// Fallback to media objects
		return getPreviewUrlFromContentMetaData(contentMetaData, mediaPreviewUrl)
	}
	return undefined
}

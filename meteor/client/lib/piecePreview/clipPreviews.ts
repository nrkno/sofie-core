import { Accessor, ExpectedPackage, ExpectedPackageStatusAPI } from '@sofie-automation/blueprints-integration'
import { getExpectedPackageId, getSideEffect } from '../../../lib/collections/ExpectedPackages'
import { ensureHasTrailingSlash } from '../../lib/lib'
import { getPackageContainerPackageStatus } from '../../../lib/globalStores'
import { PieceId } from '../../../lib/collections/Pieces'
import { Studio } from '../../../lib/collections/Studios'
import { MediaObject } from '../../../lib/collections/MediaObjects'

export function getPackagePreviewUrl(
	pieceId: PieceId,
	expectedPackages: ExpectedPackage.Any[],
	studio: Studio
): string | undefined {
	// use Expected packages:
	// Just use the first one we find.

	// TODO: support multiple expected packages?
	let packagePreviewPath: string | undefined
	let previewContainerId: string | undefined
	let expectedPackage: ExpectedPackage.Any | undefined
	for (const expPackage of expectedPackages) {
		const sideEffect = getSideEffect(expPackage, studio)
		packagePreviewPath = sideEffect.previewPackageSettings?.path
		previewContainerId = sideEffect.previewContainerId
		expectedPackage = expPackage

		if (packagePreviewPath && previewContainerId && expectedPackage) {
			break // don't look further
		}
	}
	if (packagePreviewPath && previewContainerId && expectedPackage) {
		const packageContainer = studio.packageContainers[previewContainerId]
		if (!packageContainer) return

		const packageOnPackageContainer = getPackageContainerPackageStatus(
			studio._id,
			previewContainerId,
			getExpectedPackageId(pieceId, expectedPackage._id)
		)
		if (!packageOnPackageContainer) return
		if (
			packageOnPackageContainer.status.status !==
			ExpectedPackageStatusAPI.PackageContainerPackageStatusStatus.READY
		)
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
							packagePreviewPath.replace(/^\//, '') // trim leading slash
						),
					].join('/')
				}
			}
		}
	}
}

export function getMediaPreviewUrl(
	contentMetaData: MediaObject | null,
	mediaPreviewUrl: string | undefined
): string | undefined {
	const metadata = contentMetaData
	if (metadata && metadata.previewPath && mediaPreviewUrl) {
		return ensureHasTrailingSlash(mediaPreviewUrl) + 'media/preview/' + encodeURIComponent(metadata.mediaId)
	}
}

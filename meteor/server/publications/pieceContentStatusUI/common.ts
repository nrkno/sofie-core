import { ISourceLayer, PackageInfo } from '@sofie-automation/blueprints-integration'
import { ExpectedPackageId, PackageContainerPackageId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { getPackageContainerPackageId } from '@sofie-automation/corelib/dist/dataModel/PackageContainerPackageStatus'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReadonlyDeep } from 'type-fest'
import { UIStudio } from '../../../lib/api/studios'
import { Studio } from '../../../lib/collections/Studios'
import { literal } from '../../../lib/lib'
import { PieceContentStatusObj } from '../../../lib/mediaObjects'
import { MediaObjects, PackageContainerPackageStatuses, PackageInfos, Studios } from '../../collections'
import { checkPieceContentStatus, PieceContentStatusPiece } from './checkPieceContentStatus'

export type StudioMini = Pick<UIStudio, '_id' | 'settings' | 'packageContainers' | 'mappings' | 'routeSets'>

export type StudioFields = '_id' | 'settings' | 'packageContainers' | 'mappingsWithOverrides' | 'routeSets'
export const studioFieldSpecifier = literal<IncludeAllMongoFieldSpecifier<StudioFields>>({
	_id: 1,
	settings: 1,
	packageContainers: 1,
	mappingsWithOverrides: 1,
	routeSets: 1,
})

export interface IContentStatusesUpdatePropsBase {
	invalidateAll: boolean
	invalidateStudio: StudioId

	invalidateMediaObjectMediaId: string[]
	invalidateExpectedPackageId: ExpectedPackageId[]
	invalidatePackageContainerPackageStatusesId: PackageContainerPackageId[]
}

export interface PieceDependencies {
	mediaObjects: string[]
	packageInfos: ExpectedPackageId[]
	packageContainerPackageStatuses: PackageContainerPackageId[]
}

export function addItemsWithDependenciesChangesToChangedSet<T extends ProtectedString<any>>(
	updateProps: Partial<ReadonlyDeep<IContentStatusesUpdatePropsBase>> | undefined,
	regeneratePieceIds: Set<T>,
	dependenciesMap: Map<T, PieceDependencies>
): void {
	if (
		updateProps &&
		(updateProps.invalidateExpectedPackageId?.length ||
			updateProps.invalidateMediaObjectMediaId?.length ||
			updateProps.invalidatePackageContainerPackageStatusesId?.length)
	) {
		const changedMediaObjects = new Set(updateProps.invalidateMediaObjectMediaId)
		const changedExpectedPackages = new Set(updateProps.invalidateExpectedPackageId)
		const changedPackageContainerPackages = new Set(updateProps.invalidatePackageContainerPackageStatusesId)

		for (const [pieceId, pieceDependencies] of dependenciesMap.entries()) {
			if (regeneratePieceIds.has(pieceId)) continue // skip if we already know the piece has changed

			const pieceChanged =
				pieceDependencies.mediaObjects.find((mediaId) => changedMediaObjects.has(mediaId)) ||
				pieceDependencies.packageInfos.find((pkgId) => changedExpectedPackages.has(pkgId)) ||
				pieceDependencies.packageContainerPackageStatuses.find((pkgId) =>
					changedPackageContainerPackages.has(pkgId)
				)

			if (pieceChanged) regeneratePieceIds.add(pieceId)
		}
	}
}

export async function checkPieceContentStatusAndDependencies(
	uiStudio: ReadonlyDeep<StudioMini>,
	pieceDoc: PieceContentStatusPiece,
	sourceLayer: ISourceLayer
): Promise<[status: PieceContentStatusObj, pieceDependencies: PieceDependencies]> {
	// Track the media documents that this Piece searched for, so we can invalidate it whenever one of these changes
	const pieceDependencies: PieceDependencies = {
		mediaObjects: [],
		packageInfos: [],
		packageContainerPackageStatuses: [],
	}

	// Future: refactor this method to not have the queries injected like this.

	const getMediaObject = async (mediaId: string) => {
		pieceDependencies.mediaObjects.push(mediaId)
		return MediaObjects.findOneAsync({
			studioId: uiStudio._id,
			mediaId,
		})
	}

	const getPackageInfos = async (packageId: ExpectedPackageId) => {
		pieceDependencies.packageInfos.push(packageId)
		return PackageInfos.findFetchAsync({
			studioId: uiStudio._id,
			packageId: packageId,
			type: {
				$in: [PackageInfo.Type.SCAN, PackageInfo.Type.DEEPSCAN],
			},
		})
	}

	const getPackageContainerPackageStatus2 = async (
		packageContainerId: string,
		expectedPackageId: ExpectedPackageId
	) => {
		const id = getPackageContainerPackageId(uiStudio._id, packageContainerId, expectedPackageId)
		pieceDependencies.packageContainerPackageStatuses.push(id)
		return PackageContainerPackageStatuses.findOneAsync({
			_id: id,
			studioId: uiStudio._id,
		})
	}

	const status = await checkPieceContentStatus(
		pieceDoc,
		sourceLayer,
		uiStudio,
		getMediaObject,
		getPackageInfos,
		getPackageContainerPackageStatus2
	)

	return [status, pieceDependencies]
}

export async function fetchStudio(studioId: StudioId): Promise<ReadonlyDeep<StudioMini> | undefined> {
	const studio = (await Studios.findOneAsync(studioId, {
		projection: studioFieldSpecifier,
	})) as Pick<Studio, StudioFields> | undefined

	if (!studio) {
		return undefined
	}

	return {
		_id: studio._id,
		settings: studio.settings,
		packageContainers: studio.packageContainers,
		mappings: applyAndValidateOverrides(studio.mappingsWithOverrides).obj,
		routeSets: studio.routeSets,
	}
}

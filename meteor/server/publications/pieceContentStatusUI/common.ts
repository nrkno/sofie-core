import { ExpectedPackageId, PackageContainerPackageId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { IncludeAllMongoFieldSpecifier } from '@sofie-automation/corelib/dist/mongo'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { ReadonlyDeep } from 'type-fest'
import { Studio } from '../../../lib/collections/Studios'
import { literal } from '../../../lib/lib'
import { Studios } from '../../collections'
import { PieceContentStatusStudio } from './checkPieceContentStatus'

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

export async function fetchStudio(studioId: StudioId): Promise<PieceContentStatusStudio | undefined> {
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

import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import { assertNever } from '../lib'
import { createMongoCollection } from './lib'
import { registerIndex } from '../database'

import { ExpectedPackageId } from '@sofie-automation/corelib/dist/dataModel/Ids'
export { ExpectedPackageId }

import { ExpectedPackageDB } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
export * from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'

export const ExpectedPackages = createMongoCollection<ExpectedPackageDB, ExpectedPackageDB>(
	CollectionName.ExpectedPackages
)

registerIndex(ExpectedPackages, {
	studioId: 1,
	fromPieceType: 1,
})
registerIndex(ExpectedPackages, {
	studioId: 1,
	pieceId: 1,
})
registerIndex(ExpectedPackages, {
	rundownId: 1,
	pieceId: 1,
})
export function getPreviewPackageSettings(
	expectedPackage: ExpectedPackage.Any
): ExpectedPackage.SideEffectPreviewSettings | undefined {
	let packagePath: string | undefined

	if (expectedPackage.type === ExpectedPackage.PackageType.MEDIA_FILE) {
		packagePath = expectedPackage.content.filePath
	} else if (expectedPackage.type === ExpectedPackage.PackageType.QUANTEL_CLIP) {
		packagePath = expectedPackage.content.guid || expectedPackage.content.title
	} else {
		assertNever(expectedPackage)
	}
	if (packagePath) {
		return {
			path: packagePath + '_preview.webm',
		}
	}
	return undefined
}
export function getThumbnailPackageSettings(
	expectedPackage: ExpectedPackage.Any
): ExpectedPackage.SideEffectThumbnailSettings | undefined {
	let packagePath: string | undefined

	if (expectedPackage.type === ExpectedPackage.PackageType.MEDIA_FILE) {
		packagePath = expectedPackage.content.filePath
	} else if (expectedPackage.type === ExpectedPackage.PackageType.QUANTEL_CLIP) {
		packagePath = expectedPackage.content.guid || expectedPackage.content.title
	} else {
		assertNever(expectedPackage)
	}
	if (packagePath) {
		return {
			path: packagePath + '_thumbnail.png',
		}
	}
	return undefined
}

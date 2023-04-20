import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import { assertNever, literal } from '../lib'
import { StudioPeripheralDeviceSettings } from './Studios'
import deepExtend from 'deep-extend'

export * from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'

export function getPreviewPackageSettings(
	expectedPackage: ExpectedPackage.Any
): ExpectedPackage.SideEffectPreviewSettings | undefined {
	let packagePath: string | undefined

	if (expectedPackage.type === ExpectedPackage.PackageType.MEDIA_FILE) {
		packagePath = expectedPackage.content.filePath
	} else if (expectedPackage.type === ExpectedPackage.PackageType.QUANTEL_CLIP) {
		packagePath = expectedPackage.content.guid || expectedPackage.content.title
	} else if (expectedPackage.type === ExpectedPackage.PackageType.JSON_DATA) {
		packagePath = undefined // Not supported
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
	} else if (expectedPackage.type === ExpectedPackage.PackageType.JSON_DATA) {
		packagePath = undefined // Not supported
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
export function getSideEffect(
	expectedPackage: ExpectedPackage.Base,
	studioPeripheralDeviceSettings: Pick<
		StudioPeripheralDeviceSettings,
		'previewContainerIds' | 'thumbnailContainerIds'
	>
): ExpectedPackage.Base['sideEffect'] {
	return deepExtend(
		{},
		literal<ExpectedPackage.Base['sideEffect']>({
			previewContainerId: studioPeripheralDeviceSettings.previewContainerIds[0], // just pick the first. Todo: something else?
			thumbnailContainerId: studioPeripheralDeviceSettings.thumbnailContainerIds[0], // just pick the first. Todo: something else?
			previewPackageSettings: getPreviewPackageSettings(expectedPackage as ExpectedPackage.Any),
			thumbnailPackageSettings: getThumbnailPackageSettings(expectedPackage as ExpectedPackage.Any),
		}),
		expectedPackage.sideEffect
	)
}

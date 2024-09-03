import { ExpectedPackage } from '@sofie-automation/blueprints-integration'
import { assertNever, literal } from '../lib'
import { StudioLight } from '@sofie-automation/corelib/dist/dataModel/Studio'
import {
	htmlTemplateGetSteps,
	htmlTemplateGetFileNamesFromSteps,
} from '@sofie-automation/shared-lib/dist/package-manager/helpers'
import deepExtend from 'deep-extend'
import { ReadonlyDeep } from 'type-fest'

export function getPreviewPackageSettings(
	expectedPackage: ReadonlyDeep<ExpectedPackage.Any>
): ExpectedPackage.SideEffectPreviewSettings | undefined {
	if (expectedPackage.type === ExpectedPackage.PackageType.MEDIA_FILE) {
		const packagePath = expectedPackage.content.filePath
		if (packagePath) return { path: packagePath + '_preview.webm' }
	} else if (expectedPackage.type === ExpectedPackage.PackageType.QUANTEL_CLIP) {
		const packagePath = expectedPackage.content.guid || expectedPackage.content.title
		if (packagePath) return { path: packagePath + '_preview.webm' }
	} else if (expectedPackage.type === ExpectedPackage.PackageType.JSON_DATA) {
		return undefined // Not supported
	} else if (expectedPackage.type === ExpectedPackage.PackageType.HTML_TEMPLATE) {
		const steps = htmlTemplateGetSteps(expectedPackage.version)
		const o = htmlTemplateGetFileNamesFromSteps(steps)
		if (o.mainRecording) return { path: o.mainRecording }
		else return undefined
	} else {
		assertNever(expectedPackage)
		return undefined
	}
}
export function getThumbnailPackageSettings(
	expectedPackage: ReadonlyDeep<ExpectedPackage.Any>
): ExpectedPackage.SideEffectThumbnailSettings | undefined {
	if (expectedPackage.type === ExpectedPackage.PackageType.MEDIA_FILE) {
		const packagePath = expectedPackage.content.filePath
		if (packagePath) return { path: packagePath + '_thumbnail.png' }
	} else if (expectedPackage.type === ExpectedPackage.PackageType.QUANTEL_CLIP) {
		const packagePath = expectedPackage.content.guid || expectedPackage.content.title
		if (packagePath) return { path: packagePath + '_thumbnail.png' }
	} else if (expectedPackage.type === ExpectedPackage.PackageType.JSON_DATA) {
		return undefined // Not supported
	} else if (expectedPackage.type === ExpectedPackage.PackageType.HTML_TEMPLATE) {
		// temporary implementation:
		const steps = htmlTemplateGetSteps(expectedPackage.version)
		const o = htmlTemplateGetFileNamesFromSteps(steps)
		if (o.mainScreenShot) return { path: o.mainScreenShot }
		else return undefined
	} else {
		assertNever(expectedPackage)
		return undefined
	}
}
export function getSideEffect(
	expectedPackage: ReadonlyDeep<ExpectedPackage.Base>,
	studio: Pick<StudioLight, 'previewContainerIds' | 'thumbnailContainerIds'>
): ExpectedPackage.Base['sideEffect'] {
	return deepExtend(
		{},
		literal<ExpectedPackage.Base['sideEffect']>({
			previewContainerId: studio.previewContainerIds[0], // just pick the first. Todo: something else?
			thumbnailContainerId: studio.thumbnailContainerIds[0], // just pick the first. Todo: something else?
			previewPackageSettings: getPreviewPackageSettings(expectedPackage as ReadonlyDeep<ExpectedPackage.Any>),
			thumbnailPackageSettings: getThumbnailPackageSettings(expectedPackage as ReadonlyDeep<ExpectedPackage.Any>),
		}),
		expectedPackage.sideEffect
	)
}

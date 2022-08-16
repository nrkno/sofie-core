import { ShowStyleVariantId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { ReadonlyDeep } from 'type-fest'
import {
	BasicConfigItemValue,
	ConfigManifestEntry,
	IBlueprintConfig,
	ShowStyleBlueprintManifest,
	StudioBlueprintManifest,
	TableConfigItemValue,
} from '@sofie-automation/blueprints-integration'
import { objectPathGet, objectPathSet, stringifyError } from '@sofie-automation/corelib/dist/lib'
import _ = require('underscore')
import { logger } from '../logging'
import { CommonContext } from './context'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'

/**
 * This whole ConfigRef logic will need revisiting for a multi-studio context, to ensure that there are strict boundaries across who can give to access to what.
 * Especially relevant for multi-user.
 */
// export namespace ConfigRef {
export function getStudioConfigRef(studioId: StudioId, configKey: string): string {
	return '${studio.' + studioId + '.' + configKey + '}'
}
export function getShowStyleConfigRef(showStyleVariantId: ShowStyleVariantId, configKey: string): string {
	return '${showStyle.' + showStyleVariantId + '.' + configKey + '}'
}
// export async function retrieveRefs(
// 	stringWithReferences: string,
// 	modifier?: (str: string) => string,
// 	bailOnError?: boolean
// ): Promise<string> {
// 	if (!stringWithReferences) return stringWithReferences

// 	const refs = stringWithReferences.match(/\$\{[^}]+\}/g) || []
// 	for (const ref of refs) {
// 		if (ref) {
// 			let value = (await retrieveRef(ref, bailOnError)) + ''
// 			if (value) {
// 				if (modifier) value = modifier(value)
// 				stringWithReferences = stringWithReferences.replace(ref, value)
// 			}
// 		}
// 	}
// 	return stringWithReferences
// }
// async function retrieveRef(reference: string, bailOnError?: boolean): Promise<ConfigItemValue | string | undefined> {
// 	if (!reference) return undefined
// 	const m = reference.match(/\$\{([^.}]+)\.([^.}]+)\.([^.}]+)\}/)
// 	if (m) {
// 		if (m[1] === 'studio' && _.isString(m[2]) && _.isString(m[3])) {
// 			const studioId: StudioId = protectString(m[2])
// 			const configId = m[3]
// 			const studio = await Studios.findOneAsync(studioId)
// 			if (studio) {
// 				return objectPathGet(studio.blueprintConfig, configId)
// 			} else if (bailOnError) throw new Error(`Ref "${reference}": Studio "${studioId}" not found`)
// 		} else if (m[1] === 'showStyle' && _.isString(m[2]) && _.isString(m[3])) {
// 			const showStyleVariantId = protectString<ShowStyleVariantId>(m[2])
// 			const configId = m[3]
// 			const showStyleCompound = await getShowStyleCompound(showStyleVariantId)
// 			if (showStyleCompound) {
// 				return objectPathGet(showStyleCompound.blueprintConfig, configId)
// 			} else if (bailOnError)
// 				throw new Error(`Ref "${reference}": Showstyle variant "${showStyleVariantId}" not found`)
// 		}
// 	}
// 	return undefined
// }
// }

export interface ProcessedShowStyleConfig {
	_showStyleConfig: never
}

export interface ProcessedStudioConfig {
	_studioConfig: never
}

export function preprocessStudioConfig(
	studio: ReadonlyDeep<DBStudio>,
	blueprint: ReadonlyDeep<StudioBlueprintManifest>
): ProcessedStudioConfig {
	let res: any = {}
	if (blueprint.studioConfigManifest !== undefined) {
		applyToConfig(res, blueprint.studioConfigManifest, studio.blueprintConfig, `Studio ${studio._id}`)
	} else {
		res = studio.blueprintConfig
	}

	// Expose special values as defined in the studio
	res['SofieHostURL'] = studio.settings.sofieUrl

	try {
		if (blueprint.preprocessConfig) {
			const context = new CommonContext({
				name: `preprocessStudioConfig`,
				identifier: `studioId=${studio._id}`,
			})
			res = blueprint.preprocessConfig(context, res)
		}
	} catch (err) {
		logger.error(`Error in studioBlueprint.preprocessConfig: ${stringifyError(err)}`)
	}

	return res
}

export function preprocessShowStyleConfig(
	showStyle: ReadonlyDeep<ShowStyleCompound>,
	blueprint: ReadonlyDeep<ShowStyleBlueprintManifest>
): ProcessedShowStyleConfig {
	let res: any = {}
	if (blueprint.showStyleConfigManifest !== undefined) {
		applyToConfig(res, blueprint.showStyleConfigManifest, showStyle.blueprintConfig, `ShowStyle ${showStyle._id}`)
	} else {
		res = showStyle.blueprintConfig
	}

	try {
		if (blueprint.preprocessConfig) {
			const context = new CommonContext({
				name: `preprocessShowStyleConfig`,
				identifier: `showStyleBaseId=${showStyle._id},showStyleVariantId=${showStyle.showStyleVariantId}`,
			})
			res = blueprint.preprocessConfig(context, res)
		}
	} catch (err) {
		logger.error(`Error in showStyleBlueprint.preprocessConfig: ${stringifyError(err)}`)
	}

	return res
}

export function findMissingConfigs(
	manifest: ReadonlyDeep<ConfigManifestEntry[]> | undefined,
	config: ReadonlyDeep<IBlueprintConfig>
): string[] {
	const missingKeys: string[] = []
	if (manifest === undefined) {
		return missingKeys
	}
	_.each(manifest, (m) => {
		if (m.required && config && objectPathGet(config, m.id) === undefined) {
			missingKeys.push(m.name)
		}
	})

	return missingKeys
}

export function applyToConfig(
	res: unknown,
	configManifest: ReadonlyDeep<ConfigManifestEntry[]>,
	blueprintConfig: ReadonlyDeep<IBlueprintConfig>,
	source: string
): void {
	for (const val of configManifest) {
		let newVal = val.defaultVal

		const overrideVal = objectPathGet(blueprintConfig, val.id) as
			| BasicConfigItemValue
			| TableConfigItemValue
			| undefined
		if (overrideVal !== undefined) {
			newVal = overrideVal
		} else if (val.required) {
			logger.warn(`Required config not defined in ${source}: "${val.name}"`)
		}

		objectPathSet(res, val.id, newVal)
	}
}

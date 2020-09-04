import * as _ from 'underscore'
import {
	ConfigItemValue,
	ConfigManifestEntry,
	IBlueprintConfig,
	StudioBlueprintManifest,
	ShowStyleBlueprintManifest,
	BasicConfigItemValue,
	TableConfigItemValue,
} from 'tv-automation-sofie-blueprints-integration'
import { Studios, Studio, StudioId } from '../../../lib/collections/Studios'
import { Meteor } from 'meteor/meteor'
import { getShowStyleCompound, ShowStyleVariantId, ShowStyleCompound } from '../../../lib/collections/ShowStyleVariants'
import { protectString, objectPathGet, objectPathSet } from '../../../lib/lib'
import { logger } from '../../../lib/logging'
import { DeepReadonly } from 'utility-types'

/**
 * This whole ConfigRef logic will need revisiting for a multi-studio context, to ensure that there are strict boundaries across who can give to access to what.
 * Especially relevant for multi-user.
 */
export namespace ConfigRef {
	export function getStudioConfigRef(studioId: StudioId, configKey: string): string {
		return '${studio.' + studioId + '.' + configKey + '}'
	}
	export function getShowStyleConfigRef(showStyleVariantId: ShowStyleVariantId, configKey: string): string {
		return '${showStyle.' + showStyleVariantId + '.' + configKey + '}'
	}
	export function retrieveRefs(
		stringWithReferences: string,
		modifier?: (str: string) => string,
		bailOnError?: boolean
	): string {
		if (!stringWithReferences) return stringWithReferences

		const refs = stringWithReferences.match(/\$\{[^}]+\}/g) || []
		_.each(refs, (ref) => {
			if (ref) {
				let value = retrieveRef(ref, bailOnError) + ''
				if (value) {
					if (modifier) value = modifier(value)
					stringWithReferences = stringWithReferences.replace(ref, value)
				}
			}
		})
		return stringWithReferences
	}
	function retrieveRef(reference: string, bailOnError?: boolean): ConfigItemValue | string | undefined {
		if (!reference) return undefined
		let m = reference.match(/\$\{([^.}]+)\.([^.}]+)\.([^.}]+)\}/)
		if (m) {
			if (m[1] === 'studio' && _.isString(m[2]) && _.isString(m[3])) {
				const studioId: StudioId = protectString(m[2])
				const configId = m[3]
				const studio = Studios.findOne(studioId)
				if (studio) {
					return objectPathGet(studio.blueprintConfig, configId)
				} else if (bailOnError)
					throw new Meteor.Error(404, `Ref "${reference}": Studio "${studioId}" not found`)
			} else if (m[1] === 'showStyle' && _.isString(m[2]) && _.isString(m[3])) {
				const showStyleVariantId = protectString<ShowStyleVariantId>(m[2])
				const configId = m[3]
				const showStyleCompound = getShowStyleCompound(showStyleVariantId)
				if (showStyleCompound) {
					return objectPathGet(showStyleCompound.blueprintConfig, configId)
				} else if (bailOnError)
					throw new Meteor.Error(
						404,
						`Ref "${reference}": Showstyle variant "${showStyleVariantId}" not found`
					)
			}
		}
		return undefined
	}
}

export function preprocessStudioConfig(studio: DeepReadonly<Studio>, blueprint?: StudioBlueprintManifest) {
	let res: any = {}
	if (blueprint && blueprint.studioConfigManifest !== undefined) {
		applyToConfig(res, blueprint.studioConfigManifest, studio.blueprintConfig, `Studio ${studio._id}`)
	} else {
		res = studio.blueprintConfig
	}

	// Expose special values as defined in the studio
	res['SofieHostURL'] = studio.settings.sofieUrl

	if (blueprint && blueprint.preprocessConfig) {
		res = blueprint.preprocessConfig(res)
	}
	return res
}

export function preprocessShowStyleConfig(
	showStyle: DeepReadonly<ShowStyleCompound>,
	blueprint?: ShowStyleBlueprintManifest
) {
	let res: any = {}
	if (blueprint && blueprint.showStyleConfigManifest !== undefined) {
		applyToConfig(res, blueprint.showStyleConfigManifest, showStyle.blueprintConfig, `ShowStyle ${showStyle._id}`)
	} else {
		res = showStyle.blueprintConfig
	}
	if (blueprint && blueprint.preprocessConfig) {
		res = blueprint.preprocessConfig(res)
	}
	return res
}

export function findMissingConfigs(
	manifest: ConfigManifestEntry[] | undefined,
	config: DeepReadonly<IBlueprintConfig>
) {
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
	res: any,
	configManifest: ConfigManifestEntry[],
	blueprintConfig: DeepReadonly<IBlueprintConfig>,
	source: string
) {
	for (const val of configManifest) {
		let newVal = val.defaultVal

		const overrideVal = objectPathGet(blueprintConfig, val.id) as
			| BasicConfigItemValue
			| TableConfigItemValue
			| undefined
		if (overrideVal !== undefined) {
			newVal = overrideVal
		} else if (val.required) {
			logger.warning(`Required config not defined in ${source}: "${val.name}"`)
		}

		objectPathSet(res, val.id, newVal)
	}
}

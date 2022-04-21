// import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
// import { normalizeArray } from '@sofie-automation/corelib/dist/lib'
// import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
// import { findMissingConfigs } from '../blueprints/config'
// import { createShowStyleCompound } from '../showStyles'
// import _ = require('underscore')
// import { JobContext } from '../jobs'

// interface Tmp {
// 	playlistId: RundownPlaylistId
// }

// export interface RundownPlaylistValidateBlueprintConfigResult {
// 	studio: string[]
// 	showStyles: Array<{
// 		id: string
// 		name: string
// 		checkFailed: boolean
// 		fields: string[]
// 	}>
// }

// export async function checkBlueprintConfigForPlaylist(
// 	context: JobContext,
// 	params: Tmp
// ): Promise<RundownPlaylistValidateBlueprintConfigResult> {
// 	const studioBlueprint = context.studioBlueprint

// 	const rundowns = await context.directCollections.Rundowns.findFetch({
// 		studioId: context.studioId,
// 		playlistId: params.playlistId,
// 	})
// 	const uniqueShowStyleCompounds = _.uniq(
// 		rundowns,
// 		undefined,
// 		(rundown) => `${rundown.showStyleBaseId}-${rundown.showStyleVariantId}`
// 	)

// 	// Load all variants/compounds
// 	const [showStyleBases, showStyleVariants] = await Promise.all([
// 		ShowStyleBases.findFetchAsync({
// 			_id: { $in: uniqueShowStyleCompounds.map((r) => r.showStyleBaseId) },
// 		}),
// 		ShowStyleVariants.findFetchAsync({
// 			_id: { $in: uniqueShowStyleCompounds.map((r) => r.showStyleVariantId) },
// 		}),
// 	])
// 	const showStyleBlueprints = await fetchBlueprintsLight({
// 		_id: { $in: _.uniq(_.compact(showStyleBases.map((c) => c.blueprintId))) },
// 	})

// 	const showStyleBasesMap = normalizeArray(showStyleBases, '_id')
// 	const showStyleVariantsMap = normalizeArray(showStyleVariants, '_id')
// 	const showStyleBlueprintsMap = normalizeArray(showStyleBlueprints, '_id')

// 	const showStyleWarnings: RundownPlaylistValidateBlueprintConfigResult['showStyles'] = uniqueShowStyleCompounds.map(
// 		(rundown) => {
// 			const showStyleBase = showStyleBasesMap[unprotectString(rundown.showStyleBaseId)]
// 			const showStyleVariant = showStyleVariantsMap[unprotectString(rundown.showStyleVariantId)]
// 			const id = `${rundown.showStyleBaseId}-${rundown.showStyleVariantId}`
// 			if (!showStyleBase || !showStyleVariant) {
// 				return {
// 					id: id,
// 					name: `${showStyleBase ? showStyleBase.name : rundown.showStyleBaseId}-${
// 						rundown.showStyleVariantId
// 					}`,
// 					checkFailed: true,
// 					fields: [],
// 				}
// 			}

// 			const compound = createShowStyleCompound(showStyleBase, showStyleVariant)
// 			if (!compound) {
// 				return {
// 					id: id,
// 					name: `${showStyleBase ? showStyleBase.name : rundown.showStyleBaseId}-${
// 						rundown.showStyleVariantId
// 					}`,
// 					checkFailed: true,
// 					fields: [],
// 				}
// 			}

// 			const blueprint = showStyleBlueprintsMap[unprotectString(compound.blueprintId)]
// 			if (!blueprint) {
// 				return {
// 					id: id,
// 					name: compound.name,
// 					checkFailed: true,
// 					fields: [],
// 				}
// 			} else {
// 				return {
// 					id: id,
// 					name: compound.name,
// 					checkFailed: false,
// 					fields: findMissingConfigs(blueprint.showStyleConfigManifest, compound.blueprintConfig),
// 				}
// 			}
// 		}
// 	)

// 	return {
// 		studio: findMissingConfigs(studioBlueprint.studioConfigManifest, studio.blueprintConfig),
// 		showStyles: showStyleWarnings,
// 	}
// }

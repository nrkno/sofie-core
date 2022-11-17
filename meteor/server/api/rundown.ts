import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { check } from '../../lib/check'
import { Rundowns, Rundown } from '../../lib/collections/Rundowns'
import { normalizeArrayToMap } from '../../lib/lib'
import { logger } from '../logging'
import { registerClassToMeteorMethods } from '../methods'
import { NewRundownAPI, RundownAPIMethods, RundownPlaylistValidateBlueprintConfigResult } from '../../lib/api/rundown'
import { ShowStyleVariant, ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { ShowStyleBase, ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { PackageInfo } from '../coreSystem'
import { IngestActions } from './ingest/actions'
import { RundownPlaylistCollectionUtil } from '../../lib/collections/RundownPlaylists'
import { ReloadRundownPlaylistResponse, TriggerReloadDataResponse } from '../../lib/api/userActions'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { StudioContentWriteAccess } from '../security/studio'
import { findMissingConfigs } from './blueprints/config'
import { runIngestOperation } from './ingest/lib'
import { createShowStyleCompound } from './showStyles'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import {
	checkAccessToPlaylist,
	checkAccessToRundown,
	VerifiedRundownContentAccess,
	VerifiedRundownPlaylistContentAccess,
} from './lib'
import { Blueprint, Blueprints } from '../../lib/collections/Blueprints'
import { Studio, Studios } from '../../lib/collections/Studios'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export namespace ServerRundownAPI {
	/** Remove an individual rundown */
	export async function removeRundown(access: VerifiedRundownContentAccess): Promise<void> {
		await runIngestOperation(access.rundown.studioId, IngestJobs.UserRemoveRundown, {
			rundownId: access.rundown._id,
			force: true,
		})
	}

	export async function unsyncRundown(access: VerifiedRundownContentAccess): Promise<void> {
		await runIngestOperation(access.rundown.studioId, IngestJobs.UserUnsyncRundown, {
			rundownId: access.rundown._id,
		})
	}
	/** Resync all rundowns in a rundownPlaylist */
	export async function resyncRundownPlaylist(
		access: VerifiedRundownPlaylistContentAccess
	): Promise<ReloadRundownPlaylistResponse> {
		logger.info('resyncRundownPlaylist ' + access.playlist._id)

		const rundowns = await Rundowns.findFetchAsync({ playlistId: access.playlist._id })
		const responses = await Promise.all(
			rundowns.map(async (rundown) => {
				return {
					rundownId: rundown._id,
					response: await innerResyncRundown(rundown),
				}
			})
		)

		return {
			rundownsResponses: responses,
		}
	}

	export async function innerResyncRundown(rundown: Rundown): Promise<TriggerReloadDataResponse> {
		logger.info('resyncRundown ' + rundown._id)

		// Orphaned flag will be reset by the response update
		return IngestActions.reloadRundown(rundown)
	}
}
export namespace ClientRundownAPI {
	export async function rundownPlaylistNeedsResync(
		context: MethodContext,
		playlistId: RundownPlaylistId
	): Promise<string[]> {
		check(playlistId, String)
		const access = await StudioContentWriteAccess.rundownPlaylist(context, playlistId)
		const playlist = access.playlist

		const rundowns = RundownPlaylistCollectionUtil.getRundownsUnordered(playlist)
		const errors = await Promise.all(
			rundowns.map(async (rundown) => {
				if (!rundown.importVersions) return 'unknown'

				if (rundown.importVersions.core !== PackageInfo.version) return 'coreVersion'

				const showStyleVariant = (await ShowStyleVariants.findOneAsync(rundown.showStyleVariantId, {
					fields: {
						_id: 1,
						_rundownVersionHash: 1,
					},
				})) as Pick<ShowStyleVariant, '_id' | '_rundownVersionHash'>
				if (!showStyleVariant) return 'missing showStyleVariant'
				if (rundown.importVersions.showStyleVariant !== (showStyleVariant._rundownVersionHash || 0))
					return 'showStyleVariant'

				const showStyleBase = (await ShowStyleBases.findOneAsync(rundown.showStyleBaseId, {
					fields: {
						_id: 1,
						_rundownVersionHash: 1,
						blueprintId: 1,
					},
				})) as Pick<ShowStyleBase, '_id' | '_rundownVersionHash' | 'blueprintId'>
				if (!showStyleBase) return 'missing showStyleBase'
				if (rundown.importVersions.showStyleBase !== (showStyleBase._rundownVersionHash || 0))
					return 'showStyleBase'

				const blueprint = (await Blueprints.findOneAsync(showStyleBase.blueprintId, {
					fields: {
						_id: 1,
						blueprintVersion: 1,
					},
				})) as Pick<Blueprint, '_id' | 'blueprintVersion'>
				if (!blueprint.blueprintVersion) return 'missing blueprint'
				if (rundown.importVersions.blueprint !== (blueprint.blueprintVersion || 0)) return 'blueprint'

				const studio = (await Studios.findOneAsync(rundown.studioId, {
					fields: {
						_id: 1,
						_rundownVersionHash: 1,
					},
				})) as Pick<Studio, '_id' | '_rundownVersionHash'>
				if (!studio) return 'missing studio'
				if (rundown.importVersions.studio !== (studio._rundownVersionHash || 0)) return 'studio'
			})
		)

		return _.compact(errors)
	}
	// Validate the blueprint config used for this rundown, to ensure that all the required fields are specified
	export async function rundownPlaylistValidateBlueprintConfig(
		context: MethodContext,
		playlistId: RundownPlaylistId
	): Promise<RundownPlaylistValidateBlueprintConfigResult> {
		check(playlistId, String)

		const access = await StudioContentWriteAccess.rundownPlaylist(context, playlistId)
		const rundownPlaylist = access.playlist

		const studio = Studios.findOne(rundownPlaylist.studioId)
		if (!studio) throw new Meteor.Error(404, 'Studio "' + rundownPlaylist.studioId + '" not found!')

		const studioBlueprint = studio.blueprintId
			? ((await Blueprints.findOneAsync(studio.blueprintId, {
					fields: {
						_id: 1,
						studioConfigManifest: 1,
					},
			  })) as Pick<Blueprint, '_id' | 'studioConfigManifest'>)
			: null
		if (!studioBlueprint) throw new Meteor.Error(404, `Studio blueprint "${studio.blueprintId}" not found!`)

		const rundowns = RundownPlaylistCollectionUtil.getRundownsUnordered(rundownPlaylist)
		const uniqueShowStyleCompounds = _.uniq(
			rundowns,
			undefined,
			(rundown) => `${rundown.showStyleBaseId}-${rundown.showStyleVariantId}`
		)

		// Load all variants/compounds
		const [showStyleBases, showStyleVariants] = await Promise.all([
			ShowStyleBases.findFetchAsync({
				_id: { $in: uniqueShowStyleCompounds.map((r) => r.showStyleBaseId) },
			}),
			ShowStyleVariants.findFetchAsync({
				_id: { $in: uniqueShowStyleCompounds.map((r) => r.showStyleVariantId) },
			}),
		])
		const showStyleBlueprints = (await Blueprints.findFetchAsync(
			{
				_id: { $in: _.uniq(_.compact(showStyleBases.map((c) => c.blueprintId))) },
			},
			{
				fields: {
					_id: 1,
					showStyleConfigManifest: 1,
				},
			}
		)) as Array<Pick<Blueprint, '_id' | 'showStyleConfigManifest'>>

		const showStyleBasesMap = normalizeArrayToMap(showStyleBases, '_id')
		const showStyleVariantsMap = normalizeArrayToMap(showStyleVariants, '_id')
		const showStyleBlueprintsMap = normalizeArrayToMap(showStyleBlueprints, '_id')

		const showStyleWarnings: RundownPlaylistValidateBlueprintConfigResult['showStyles'] =
			uniqueShowStyleCompounds.map((rundown) => {
				const showStyleBase = showStyleBasesMap.get(rundown.showStyleBaseId)
				const showStyleVariant = showStyleVariantsMap.get(rundown.showStyleVariantId)
				const id = `${rundown.showStyleBaseId}-${rundown.showStyleVariantId}`
				if (!showStyleBase || !showStyleVariant) {
					return {
						id: id,
						name: `${showStyleBase ? showStyleBase.name : rundown.showStyleBaseId}-${
							rundown.showStyleVariantId
						}`,
						checkFailed: true,
						fields: [],
					}
				}

				const compound = createShowStyleCompound(showStyleBase, showStyleVariant)
				if (!compound) {
					return {
						id: id,
						name: `${showStyleBase ? showStyleBase.name : rundown.showStyleBaseId}-${
							rundown.showStyleVariantId
						}`,
						checkFailed: true,
						fields: [],
					}
				}

				const blueprint = showStyleBlueprintsMap.get(compound.blueprintId)
				if (!blueprint) {
					return {
						id: id,
						name: compound.name,
						checkFailed: true,
						fields: [],
					}
				} else {
					return {
						id: id,
						name: compound.name,
						checkFailed: false,
						fields: findMissingConfigs(blueprint.showStyleConfigManifest, compound.combinedBlueprintConfig),
					}
				}
			})

		const studioBlueprintConfig = applyAndValidateOverrides(studio.blueprintConfigWithOverrides).obj
		return {
			studio: findMissingConfigs(studioBlueprint.studioConfigManifest, studioBlueprintConfig),
			showStyles: showStyleWarnings,
		}
	}
}

class ServerRundownAPIClass extends MethodContextAPI implements NewRundownAPI {
	async resyncRundownPlaylist(playlistId: RundownPlaylistId) {
		check(playlistId, String)
		const access = await checkAccessToPlaylist(this, playlistId)

		return ServerRundownAPI.resyncRundownPlaylist(access)
	}
	async rundownPlaylistNeedsResync(playlistId: RundownPlaylistId) {
		return ClientRundownAPI.rundownPlaylistNeedsResync(this, playlistId)
	}
	async rundownPlaylistValidateBlueprintConfig(playlistId: RundownPlaylistId) {
		return ClientRundownAPI.rundownPlaylistValidateBlueprintConfig(this, playlistId)
	}
	async removeRundown(rundownId: RundownId) {
		const access = await checkAccessToRundown(this, rundownId)
		return ServerRundownAPI.removeRundown(access)
	}
	async resyncRundown(rundownId: RundownId) {
		const access = await checkAccessToRundown(this, rundownId)
		return ServerRundownAPI.innerResyncRundown(access.rundown)
	}
	async unsyncRundown(rundownId: RundownId) {
		const access = await checkAccessToRundown(this, rundownId)
		return ServerRundownAPI.unsyncRundown(access)
	}
}
registerClassToMeteorMethods(RundownAPIMethods, ServerRundownAPIClass, false)

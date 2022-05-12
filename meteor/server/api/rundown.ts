import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { check } from '../../lib/check'
import { Rundowns, Rundown, RundownId } from '../../lib/collections/Rundowns'
import { unprotectString, makePromise, normalizeArray, waitForPromise } from '../../lib/lib'
import { logger } from '../logging'
import { registerClassToMeteorMethods } from '../methods'
import { NewRundownAPI, RundownAPIMethods, RundownPlaylistValidateBlueprintConfigResult } from '../../lib/api/rundown'
import { ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { PackageInfo } from '../coreSystem'
import { IngestActions } from './ingest/actions'
import { RundownPlaylistId, RundownPlaylistCollectionUtil } from '../../lib/collections/RundownPlaylists'
import { ReloadRundownPlaylistResponse, TriggerReloadDataResponse } from '../../lib/api/userActions'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { StudioContentWriteAccess } from '../security/studio'
import { findMissingConfigs } from './blueprints/config'
import { runIngestOperation } from './ingest/lib'
import { createShowStyleCompound } from './showStyles'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/lib/securityVerify'
import {
	fetchBlueprintLight,
	fetchBlueprintsLight,
	fetchBlueprintVersion,
	fetchShowStyleBaseLight,
	fetchStudioLight,
} from '../../lib/collections/optimizations'
import {
	checkAccessToPlaylist,
	checkAccessToRundown,
	VerifiedRundownContentAccess,
	VerifiedRundownPlaylistContentAccess,
} from './lib'

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

		// if (rundown.active) throw new Meteor.Error(400,`Not allowed to resync an active Rundown "${rundownId}".`)

		// Orphaned flag will be reset by the response update
		return IngestActions.reloadRundown(rundown)
	}
}
export namespace ClientRundownAPI {
	export function rundownPlaylistNeedsResync(context: MethodContext, playlistId: RundownPlaylistId): string[] {
		check(playlistId, String)
		const access = StudioContentWriteAccess.rundownPlaylist(context, playlistId)
		const playlist = access.playlist

		const rundowns = RundownPlaylistCollectionUtil.getRundowns(playlist)
		const errors = rundowns.map((rundown) => {
			if (!rundown.importVersions) return 'unknown'

			if (rundown.importVersions.core !== PackageInfo.version) return 'coreVersion'

			const showStyleVariant = ShowStyleVariants.findOne(rundown.showStyleVariantId)
			if (!showStyleVariant) return 'missing showStyleVariant'
			if (rundown.importVersions.showStyleVariant !== (showStyleVariant._rundownVersionHash || 0))
				return 'showStyleVariant'

			const showStyleBase = fetchShowStyleBaseLight(rundown.showStyleBaseId)
			if (!showStyleBase) return 'missing showStyleBase'
			if (rundown.importVersions.showStyleBase !== (showStyleBase._rundownVersionHash || 0))
				return 'showStyleBase'

			const blueprintVersion = waitForPromise(fetchBlueprintVersion(showStyleBase.blueprintId))
			if (!blueprintVersion) return 'missing blueprint'
			if (rundown.importVersions.blueprint !== (blueprintVersion || 0)) return 'blueprint'

			const studio = fetchStudioLight(rundown.studioId)
			if (!studio) return 'missing studio'
			if (rundown.importVersions.studio !== (studio._rundownVersionHash || 0)) return 'studio'
		})

		return _.compact(errors)
	}
	// Validate the blueprint config used for this rundown, to ensure that all the required fields are specified
	export async function rundownPlaylistValidateBlueprintConfig(
		context: MethodContext,
		playlistId: RundownPlaylistId
	): Promise<RundownPlaylistValidateBlueprintConfigResult> {
		check(playlistId, String)

		const access = StudioContentWriteAccess.rundownPlaylist(context, playlistId)
		const rundownPlaylist = access.playlist

		const studio = RundownPlaylistCollectionUtil.getStudio(rundownPlaylist)
		const studioBlueprint = studio.blueprintId ? await fetchBlueprintLight(studio.blueprintId) : null
		if (!studioBlueprint) throw new Meteor.Error(404, `Studio blueprint "${studio.blueprintId}" not found!`)

		const rundowns = RundownPlaylistCollectionUtil.getRundowns(rundownPlaylist)
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
		const showStyleBlueprints = await fetchBlueprintsLight({
			_id: { $in: _.uniq(_.compact(showStyleBases.map((c) => c.blueprintId))) },
		})

		const showStyleBasesMap = normalizeArray(showStyleBases, '_id')
		const showStyleVariantsMap = normalizeArray(showStyleVariants, '_id')
		const showStyleBlueprintsMap = normalizeArray(showStyleBlueprints, '_id')

		const showStyleWarnings: RundownPlaylistValidateBlueprintConfigResult['showStyles'] =
			uniqueShowStyleCompounds.map((rundown) => {
				const showStyleBase = showStyleBasesMap[unprotectString(rundown.showStyleBaseId)]
				const showStyleVariant = showStyleVariantsMap[unprotectString(rundown.showStyleVariantId)]
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

				const blueprint = showStyleBlueprintsMap[unprotectString(compound.blueprintId)]
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
						fields: findMissingConfigs(blueprint.showStyleConfigManifest, compound.blueprintConfig),
					}
				}
			})

		return {
			studio: findMissingConfigs(studioBlueprint.studioConfigManifest, studio.blueprintConfig),
			showStyles: showStyleWarnings,
		}
	}
}

class ServerRundownAPIClass extends MethodContextAPI implements NewRundownAPI {
	async removeRundownPlaylist(_playlistId: RundownPlaylistId) {
		triggerWriteAccessBecauseNoCheckNecessary()

		throw new Error('Removed')
	}
	async resyncRundownPlaylist(playlistId: RundownPlaylistId) {
		check(playlistId, String)
		const access = checkAccessToPlaylist(this, playlistId)

		return ServerRundownAPI.resyncRundownPlaylist(access)
	}
	async rundownPlaylistNeedsResync(playlistId: RundownPlaylistId) {
		return makePromise(() => ClientRundownAPI.rundownPlaylistNeedsResync(this, playlistId))
	}
	async rundownPlaylistValidateBlueprintConfig(playlistId: RundownPlaylistId) {
		return ClientRundownAPI.rundownPlaylistValidateBlueprintConfig(this, playlistId)
	}
	async removeRundown(rundownId: RundownId) {
		const access = checkAccessToRundown(this, rundownId)
		return ServerRundownAPI.removeRundown(access)
	}
	async resyncRundown(rundownId: RundownId) {
		const access = checkAccessToRundown(this, rundownId)
		return ServerRundownAPI.innerResyncRundown(access.rundown)
	}
	async unsyncRundown(rundownId: RundownId) {
		const access = checkAccessToRundown(this, rundownId)
		return ServerRundownAPI.unsyncRundown(access)
	}
	async moveRundown(
		_rundownId: RundownId,
		_intoPlaylistId: RundownPlaylistId | null,
		_rundownsIdsInPlaylistInOrder: RundownId[]
	) {
		triggerWriteAccessBecauseNoCheckNecessary()

		throw new Error('Removed')
	}
	async restoreRundownsInPlaylistToDefaultOrder(_playlistId: RundownPlaylistId) {
		triggerWriteAccessBecauseNoCheckNecessary()

		throw new Error('Removed')
	}
}
registerClassToMeteorMethods(RundownAPIMethods, ServerRundownAPIClass, false)

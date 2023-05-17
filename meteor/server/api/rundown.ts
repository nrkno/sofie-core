import * as _ from 'underscore'
import { check } from '../../lib/check'
import { logger } from '../logging'
import { registerClassToMeteorMethods } from '../methods'
import { NewRundownAPI, RundownAPIMethods } from '../../lib/api/rundown'
import { ShowStyleVariant } from '../../lib/collections/ShowStyleVariants'
import { ShowStyleBase } from '../../lib/collections/ShowStyleBases'
import { PackageInfo } from '../coreSystem'
import { IngestActions } from './ingest/actions'
import { ReloadRundownPlaylistResponse, TriggerReloadDataResponse } from '../../lib/api/userActions'
import { MethodContextAPI, MethodContext } from '../../lib/api/methods'
import { StudioContentWriteAccess } from '../security/studio'
import { runIngestOperation } from './ingest/lib'
import { IngestJobs } from '@sofie-automation/corelib/dist/worker/ingest'
import { VerifiedRundownContentAccess, VerifiedRundownPlaylistContentAccess } from './lib'
import { Blueprint } from '../../lib/collections/Blueprints'
import { Studio } from '../../lib/collections/Studios'
import { RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Blueprints, Rundowns, ShowStyleBases, ShowStyleVariants, Studios } from '../collections'

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
					response: await IngestActions.reloadRundown(rundown),
				}
			})
		)

		return {
			rundownsResponses: responses,
		}
	}

	export async function resyncRundown(access: VerifiedRundownContentAccess): Promise<TriggerReloadDataResponse> {
		return IngestActions.reloadRundown(access.rundown)
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

		const rundowns = await Rundowns.findFetchAsync(
			{
				playlistId: playlist._id,
			},
			{
				sort: { _id: 1 },
			}
		)

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
}

class ServerRundownAPIClass extends MethodContextAPI implements NewRundownAPI {
	async rundownPlaylistNeedsResync(playlistId: RundownPlaylistId) {
		return ClientRundownAPI.rundownPlaylistNeedsResync(this, playlistId)
	}
}
registerClassToMeteorMethods(RundownAPIMethods, ServerRundownAPIClass, false)

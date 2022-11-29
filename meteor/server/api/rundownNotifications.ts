import { Meteor } from 'meteor/meteor'
import {
	RundownNotificationsAPI,
	IMediaObjectIssue,
	RundownNotificationsAPIMethods,
	MEDIASTATUS_POLL_INTERVAL,
} from '../../lib/api/rundownNotifications'
import { registerClassToMeteorMethods } from '../methods'
import { Rundowns } from '../../lib/collections/Rundowns'
import { PartNote } from '@sofie-automation/corelib/dist/dataModel/Notes'
import { cacheResultAsync, makePromise, normalizeArrayToMap } from '../../lib/lib'
import { getSegmentPartNotes } from '../../lib/rundownNotifications'
import { MethodContextAPI } from '../../lib/api/methods'
import { RundownReadAccess } from '../security/rundown'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/lib/securityVerify'
import _ from 'underscore'
import { Parts } from '../../lib/collections/Parts'
import { Pieces, PieceStatusCode } from '../../lib/collections/Pieces'
import { Segments } from '../../lib/collections/Segments'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { Studios } from '../../lib/collections/Studios'
import { checkPieceContentStatus } from '../../lib/mediaObjects'
import { RundownId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { RundownPlaylistReadAccess } from '../security/rundownPlaylist'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { UIStudio } from '../../lib/api/studios'

async function getMediaObjectIssues(rundownIds: RundownId[]): Promise<IMediaObjectIssue[]> {
	const rundowns = await Rundowns.findFetchAsync({
		_id: {
			$in: rundownIds,
		},
	})

	const allStatus = Promise.all(
		rundowns.map(async (rundown) => {
			const [showStyle, rundownStudio] = await Promise.all([
				ShowStyleBases.findOneAsync(rundown.showStyleBaseId),
				Studios.findOneAsync(rundown.studioId),
			])

			if (showStyle && rundownStudio) {
				const showStyleBase = showStyle
				const studio = rundownStudio

				const sourceLayers = applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj

				const pSegments = Segments.findFetchAsync({ rundownId: rundown._id })

				const pieces = await Pieces.findFetchAsync({
					startRundownId: rundown._id,
				})
				const parts = await Parts.findFetchAsync(
					{
						_id: { $in: pieces.map((p) => p.startPartId) },
					},
					{
						fields: {
							_id: 1,
							_rank: 1,
							title: 1,
							segmentId: 1,
						},
					}
				)
				const partMap = normalizeArrayToMap(parts, '_id')
				const segmentsMap = normalizeArrayToMap(await pSegments, '_id')

				const uiStudio: Pick<UIStudio, '_id' | 'settings' | 'packageContainers' | 'mappings' | 'routeSets'> = {
					_id: studio._id,
					settings: studio.settings,
					packageContainers: studio.packageContainers,
					mappings: applyAndValidateOverrides(studio.mappingsWithOverrides).obj,
					routeSets: studio.routeSets,
				}

				const pieceStatus = pieces.map(async (piece) =>
					makePromise(() => {
						// run these in parallel. checkPieceContentStatus does some db ops
						const sourceLayer = sourceLayers[piece.sourceLayerId]
						const part = partMap.get(piece.startPartId)
						const segment = part ? segmentsMap.get(part.segmentId) : undefined
						if (segment && sourceLayer && part) {
							// we don't want this to be in a non-reactive context, so we manage this computation manually
							const { status, messages } = checkPieceContentStatus(piece, sourceLayer, uiStudio)
							if (
								status !== PieceStatusCode.OK &&
								status !== PieceStatusCode.UNKNOWN &&
								status !== PieceStatusCode.SOURCE_NOT_SET
							) {
								return literal<IMediaObjectIssue>({
									rundownId: part.rundownId,
									segmentId: segment._id,
									segmentRank: segment._rank,
									segmentName: segment.name,
									partId: part._id,
									partRank: part._rank,
									pieceId: piece._id,
									name: piece.name,
									status,
									messages,
								})
							}
						}
						return undefined
					})
				)
				return _.compact(await Promise.all(pieceStatus))
			}
		})
	)

	return _.compact(_.flatten(await allStatus))
}

class ServerRundownNotificationsAPI extends MethodContextAPI implements RundownNotificationsAPI {
	async getSegmentPartNotes(
		playlistId: RundownPlaylistId,
		rundownIds: RundownId[]
	): Promise<(PartNote & { rank: number })[]> {
		triggerWriteAccessBecauseNoCheckNecessary()
		if (!(await RundownPlaylistReadAccess.rundownPlaylistContent(playlistId, this)))
			throw new Meteor.Error(401, 'Invalid access creditials for Segment Parts Notes')

		if (!(await RundownReadAccess.rundownContent({ $in: rundownIds }, this))) {
			throw new Meteor.Error(401, 'Invalid access creditials for Segment Parts Notes')
		}

		return getSegmentPartNotes(playlistId, rundownIds)
	}
	async getMediaObjectIssues(rundownIds: RundownId[]): Promise<IMediaObjectIssue[]> {
		triggerWriteAccessBecauseNoCheckNecessary()

		return cacheResultAsync(
			`getMediaObjectIssues${rundownIds.join(',')}`,
			async () => {
				if (!RundownReadAccess.rundownContent({ $in: rundownIds }, this)) {
					throw new Meteor.Error(401, 'Invalid access creditials for Media Object Issues')
				}

				return getMediaObjectIssues.apply(this, [rundownIds])
			},
			MEDIASTATUS_POLL_INTERVAL
		)
	}
}
registerClassToMeteorMethods(RundownNotificationsAPIMethods, ServerRundownNotificationsAPI, false)

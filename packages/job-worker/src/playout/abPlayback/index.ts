import { ResolvedPieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ABSessionAssignments, DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { endTrace, sendTrace, startTrace } from '@sofie-automation/corelib/dist/influxdb'
import { WrappedShowStyleBlueprint } from '../../blueprints/cache'
import { ReadonlyDeep } from 'type-fest'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs'
import { getCurrentTime } from '../../lib'
import { resolveAbAssignmentsFromRequests } from './abPlaybackResolver'
import { calculateSessionTimeRanges } from './abPlaybackSessions'
import { applyAbPlayerObjectAssignments } from './applyAssignments'
import { AbSessionHelper } from './abSessionHelper'
import { ShowStyleContext } from '../../blueprints/context'
import { logger } from '../../logging'
import { ABPlayerDefinition } from '@sofie-automation/blueprints-integration'

/**
 * Resolve and apply AB-playback for the given timeline
 * @param context Context of the job
 * @param abSessionHelper Helper for generation sessionId
 * @param blueprint Blueprint of the currently playing ShowStyle
 * @param showStyle The currently playing ShowStyle
 * @param playlist The currently playing Playlist
 * @param resolvedPieces All the PieceInstances on the timeline, resolved to have 'accurate' playback timings
 * @param timelineObjects The current timeline
 * @returns New AB assignments to be persisted on the playlist for the next call
 */
export function applyAbPlaybackForTimeline(
	context: JobContext,
	abSessionHelper: AbSessionHelper,
	blueprint: ReadonlyDeep<WrappedShowStyleBlueprint>,
	showStyle: ReadonlyDeep<ProcessedShowStyleCompound>,
	playlist: ReadonlyDeep<DBRundownPlaylist>,
	resolvedPieces: ResolvedPieceInstance[],
	timelineObjects: OnGenerateTimelineObjExt[]
): Record<string, ABSessionAssignments> {
	if (!blueprint.blueprint.getAbResolverConfiguration) return {}

	const blueprintContext = new ShowStyleContext(
		{
			name: playlist.name,
			identifier: `playlistId=${playlist._id},previousPartInstance=${playlist.previousPartInfo?.partInstanceId},currentPartInstance=${playlist.currentPartInfo?.partInstanceId},nextPartInstance=${playlist.nextPartInfo?.partInstanceId}`,
		},
		context.studio,
		context.getStudioBlueprintConfig(),
		showStyle,
		context.getShowStyleBlueprintConfig(showStyle)
	)

	const previousAbSessionAssignments: Record<string, ABSessionAssignments> = playlist.assignedAbSessions || {}
	const newAbSessionsResult: Record<string, ABSessionAssignments> = {}

	const span = context.startSpan('blueprint.abPlaybackResolver')
	const influxTrace = startTrace('blueprints:abPlaybackResolver')

	const now = getCurrentTime()

	const abConfiguration = blueprint.blueprint.getAbResolverConfiguration(blueprintContext)
	for (const [poolName, players] of Object.entries<ABPlayerDefinition[]>(abConfiguration.pools)) {
		const previousAssignmentMap: ABSessionAssignments = previousAbSessionAssignments[poolName] || {}
		const sessionRequests = calculateSessionTimeRanges(
			abSessionHelper,
			resolvedPieces,
			timelineObjects,
			previousAssignmentMap,
			poolName
		)

		const assignments = resolveAbAssignmentsFromRequests(
			abConfiguration.resolverOptions,
			players.map((player) => player.playerId),
			sessionRequests,
			now
		)

		logger.silly(`ABPlayback resolved sessions for "${poolName}": ${JSON.stringify(assignments)}`)
		if (assignments.failedRequired.length > 0) {
			logger.warn(
				`ABPlayback failed to assign sessions for "${poolName}": ${JSON.stringify(assignments.failedRequired)}`
			)
		}
		if (assignments.failedOptional.length > 0) {
			logger.info(
				`ABPlayback failed to assign optional sessions for "${poolName}": ${JSON.stringify(
					assignments.failedOptional
				)}`
			)
		}

		newAbSessionsResult[poolName] = applyAbPlayerObjectAssignments(
			abSessionHelper,
			blueprintContext,
			abConfiguration,
			timelineObjects,
			previousAssignmentMap,
			assignments.requests,
			poolName
		)
	}

	sendTrace(endTrace(influxTrace))
	if (span) span.end()

	return newAbSessionsResult
}

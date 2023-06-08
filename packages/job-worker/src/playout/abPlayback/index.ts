import { ResolvedPieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { ABSessionAssignments, DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { OnGenerateTimelineObjExt } from '@sofie-automation/corelib/dist/dataModel/Timeline'
import { endTrace, sendTrace, startTrace } from '@sofie-automation/corelib/dist/influxdb'
import { logger } from 'elastic-apm-node'
import { WrappedShowStyleBlueprint } from '../../blueprints/cache'
import { ReadonlyDeep } from 'type-fest'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs'
import { getCurrentTime } from '../../lib'
import { resolveAbAssignmentsFromRequests } from './abPlaybackResolver'
import { calculateSessionTimeRanges } from './abPlaybackSessions'
import { applyAbPlayerObjectAssignments } from './applyAssignments'
import { AbSessionHelper } from './abSessionHelper'
import { ShowStyleContext } from '../../blueprints/context'

export function applyAbPlaybackForTimeline(
	context: JobContext,
	abHelper: AbSessionHelper,
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
	for (const [poolName, playerIds] of Object.entries<number[]>(abConfiguration.pools)) {
		const previousAssignmentMap: ABSessionAssignments = previousAbSessionAssignments[poolName] || {}
		const sessionRequests = calculateSessionTimeRanges(
			abHelper,
			resolvedPieces,
			timelineObjects,
			previousAssignmentMap,
			poolName
		)

		const assignments = resolveAbAssignmentsFromRequests(
			abConfiguration.resolverOptions,
			playerIds,
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
			abHelper,
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

import { PieceAbSessionInfo, AB_MEDIA_PLAYER_AUTO } from '@sofie-automation/blueprints-integration'
import { PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TimelineObjectAbSessionInfo } from '@sofie-automation/shared-lib/dist/core/model/Timeline'

/**
 * Make the sessionName unique for the pool, and ensure it isn't set to AUTO
 */
export function validateSessionName(
	pieceInstanceId: PieceInstanceId | string,
	session: PieceAbSessionInfo | TimelineObjectAbSessionInfo
): string {
	const newName = session.sessionName === AB_MEDIA_PLAYER_AUTO ? pieceInstanceId : session.sessionName
	return `${session.poolName}_${newName}`
}

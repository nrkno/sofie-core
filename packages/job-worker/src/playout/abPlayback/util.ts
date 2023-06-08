import { PieceAbSessionInfo, AB_MEDIA_PLAYER_AUTO } from '@sofie-automation/blueprints-integration'
import { PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { TimelineObjectAbSessionInfo } from '@sofie-automation/shared-lib/dist/core/model/Timeline'

export function validateSessionName(
	pieceInstanceId: PieceInstanceId | string,
	session: PieceAbSessionInfo | TimelineObjectAbSessionInfo
): string {
	const newName = session.name === AB_MEDIA_PLAYER_AUTO ? pieceInstanceId : session.name
	return `${session.pool}_${newName}`
}

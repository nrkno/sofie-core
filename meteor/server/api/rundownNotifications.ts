import { RundownNotificationsAPI as APIInterface, IMediaObjectIssue } from '../../lib/api/rundownNotifications'
import { registerClassToMeteorMethods } from '../methods'
import { RundownId } from '../../lib/collections/Rundowns'
import { PartNote } from '../../lib/api/notes'

class RundownNotificationsAPI implements APIInterface {
	getSegmentPartNotes(rRundownIds: RundownId[]): Promise<(PartNote & { rank: number; })[]> {
		
	}
	getMediaObjectIssues(rundownId: RundownId): Promise<IMediaObjectIssue[]> {
		
	}
}
registerClassToMeteorMethods(RundownNotificationsAPI, RundownNotificationsAPI, false)

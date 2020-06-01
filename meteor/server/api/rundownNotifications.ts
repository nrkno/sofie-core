import {
	RundownNotificationsAPI as APIInterface,
	IMediaObjectIssue,
	RundownNotificationsAPIMethods,
} from '../../lib/api/rundownNotifications'
import { registerClassToMeteorMethods } from '../methods'
import { RundownId } from '../../lib/collections/Rundowns'
import { PartNote } from '../../lib/api/notes'
import { makePromise } from '../../lib/lib'
import { getSegmentPartNotes, getMediaObjectIssues } from '../../lib/rundownNotifications'

class RundownNotificationsAPI implements APIInterface {
	getSegmentPartNotes(rundownIds: RundownId[]): Promise<(PartNote & { rank: number })[]> {
		const that = this
		return makePromise(() => getSegmentPartNotes.apply(that, [rundownIds]))
	}
	getMediaObjectIssues(rundownIds: RundownId[]): Promise<IMediaObjectIssue[]> {
		const that = this
		return makePromise(() => getMediaObjectIssues.apply(that, [rundownIds]))
	}
}
registerClassToMeteorMethods(RundownNotificationsAPIMethods, RundownNotificationsAPI, false)

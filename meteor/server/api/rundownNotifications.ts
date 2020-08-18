import { Meteor } from 'meteor/meteor'
import { MethodContextAPI } from '../../lib/api/methods'
import { PartNote } from '../../lib/api/notes'
import {
	IMediaObjectIssue,
	RundownNotificationsAPI,
	RundownNotificationsAPIMethods,
} from '../../lib/api/rundownNotifications'
import { RundownId } from '../../lib/collections/Rundowns'
import { makePromise } from '../../lib/lib'
import { getMediaObjectIssues, getSegmentPartNotes } from '../../lib/rundownNotifications'
import { registerClassToMeteorMethods } from '../methods'
import { triggerWriteAccessBecauseNoCheckNecessary } from '../security/lib/securityVerify'
import { RundownReadAccess } from '../security/rundown'

class ServerRundownNotificationsAPI extends MethodContextAPI implements RundownNotificationsAPI {
	getSegmentPartNotes(rundownIds: RundownId[]): Promise<(PartNote & { rank: number })[]> {
		triggerWriteAccessBecauseNoCheckNecessary()
		rundownIds.forEach((rundownId) => {
			if (!RundownReadAccess.rundownContent({ rundownId }, this)) {
				throw new Meteor.Error(401, 'Invalid access creditials for Segment Parts Notes')
			}
		})
		return makePromise(() => getSegmentPartNotes.apply(this, [rundownIds]))
	}
	getMediaObjectIssues(rundownIds: RundownId[]): Promise<IMediaObjectIssue[]> {
		triggerWriteAccessBecauseNoCheckNecessary()
		rundownIds.forEach((rundownId) => {
			if (!RundownReadAccess.rundownContent({ rundownId }, this)) {
				throw new Meteor.Error(401, 'Invalid access creditials for Media Object Issues')
			}
		})
		return makePromise(() => getMediaObjectIssues.apply(this, [rundownIds]))
	}
}
registerClassToMeteorMethods(RundownNotificationsAPIMethods, ServerRundownNotificationsAPI, false)

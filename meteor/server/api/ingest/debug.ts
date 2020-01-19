import * as _ from 'underscore'
import { check } from 'meteor/check'
import { Methods, setMeteorMethods } from '../../../lib/methods'
import { IngestActions } from './actions'
import { updateTimeline } from '../playout/timeline'

let methods: Methods = {}

methods['debug_rundownRunBlueprints'] = (rundownId: string, purgeExisting?: boolean) => {
	check(rundownId, String)

	IngestActions.regenerateRundown(rundownId, purgeExisting)
}

methods['debug_updateTimeline'] = (studioId: string) => {
	check(studioId, String)

	updateTimeline(studioId)
}


setMeteorMethods(methods)

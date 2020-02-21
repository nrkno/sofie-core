import * as _ from 'underscore'
import { check } from 'meteor/check'
import { Methods, setMeteorMethods } from '../../methods'
import { IngestActions } from './actions'
import { updateTimeline } from '../playout/timeline'
import { updatePartRanks } from '../rundown';

let methods: Methods = {}

methods['debug_rundownRunBlueprints'] = (rundownId: string, purgeExisting?: boolean) => {
	check(rundownId, String)

	IngestActions.regenerateRundown(rundownId, purgeExisting)
}

methods['debug_updateTimeline'] = (studioId: string) => {
	check(studioId, String)

	updateTimeline(studioId)
}

methods['debug_updatePartRanks'] = (rundownId: string) => {
	check(rundownId, String)

	updatePartRanks(rundownId)
}


setMeteorMethods(methods)

import * as _ from 'underscore'
import { check } from 'meteor/check'
import { Methods, setMeteorMethods } from '../../methods'
import { IngestActions } from './actions'

let methods: Methods = {}

methods['debug_rundownRunBlueprints'] = (rundownId: string, purgeExisting?: boolean) => {
	check(rundownId, String)

	IngestActions.regenerateRundown(rundownId, purgeExisting)
}

setMeteorMethods(methods)

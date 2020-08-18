import { Meteor } from 'meteor/meteor'
import { ProtectedString, registerCollection } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { createMongoCollection } from './lib'
import { RundownId } from './Rundowns'
import { TimelineObjGeneric } from './Timeline'

/** A string, identifying a RundownBaselineObj */
export type RundownBaselineObjId = ProtectedString<'RundownBaselineObjId'>

export interface RundownBaselineObj {
	_id: RundownBaselineObjId
	/** The rundown this timeline-object belongs to */
	rundownId: RundownId

	objects: TimelineObjGeneric[]
}

export const RundownBaselineObjs: TransformedCollection<RundownBaselineObj, RundownBaselineObj> = createMongoCollection<
	RundownBaselineObj
>('rundownBaselineObjs')
registerCollection('RundownBaselineObjs', RundownBaselineObjs)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RundownBaselineObjs._ensureIndex({
			rundownId: 1,
		})
	}
})

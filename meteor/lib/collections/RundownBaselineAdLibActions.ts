import { Meteor } from 'meteor/meteor'
import { ProtectedString, registerCollection } from '../lib'
import { TransformedCollection } from '../typings/meteor'
import { AdLibActionCommon } from './AdLibActions'
import { createMongoCollection } from './lib'

/** A string, identifying an RundownBaselineAdLibActionId */
export type RundownBaselineAdLibActionId = ProtectedString<'RundownBaselineAdLibActionId'>

export interface RundownBaselineAdLibAction extends AdLibActionCommon {
	_id: RundownBaselineAdLibActionId
}

export const RundownBaselineAdLibActions: TransformedCollection<
	RundownBaselineAdLibAction,
	RundownBaselineAdLibAction
> = createMongoCollection<RundownBaselineAdLibAction>('rundownBaselineAdLibActions')
registerCollection('RundownBaselineAdLibActions', RundownBaselineAdLibActions)
Meteor.startup(() => {
	if (Meteor.isServer) {
		RundownBaselineAdLibActions._ensureIndex({
			rundownId: 1,
		})
	}
})

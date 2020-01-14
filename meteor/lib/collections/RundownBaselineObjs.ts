import { TransformedCollection } from '../typings/meteor';
import { registerCollection } from '../lib';
import { Meteor } from 'meteor/meteor';
import { TimelineObjGeneric } from './Timeline';
import { createMongoCollection } from './lib';

export interface RundownBaselineObj {
	_id: string;
	/** The rundown this timeline-object belongs to */
	rundownId: string;

	objects: TimelineObjGeneric[];
}

export const RundownBaselineObjs: TransformedCollection<
	RundownBaselineObj,
	RundownBaselineObj
> = createMongoCollection<RundownBaselineObj>('rundownBaselineObjs');
registerCollection('RundownBaselineObjs', RundownBaselineObjs);
Meteor.startup(() => {
	if (Meteor.isServer) {
		RundownBaselineObjs._ensureIndex({
			rundownId: 1
		});
	}
});

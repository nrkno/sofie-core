import { TransformedCollection } from '../typings/meteor';
import { Time, registerCollection } from '../lib';
import { Meteor } from 'meteor/meteor';
import { createMongoCollection } from './lib';
export interface Evaluation extends EvaluationBase {
	_id: string;
	userId: string;
	timestamp: Time;
}
export interface EvaluationBase {
	studioId: string;
	rundownId: string;
	answers: {
		[key: string]: string;
	};
	snapshots?: Array<string>;
}

export const Evaluations: TransformedCollection<
	Evaluation,
	Evaluation
> = createMongoCollection<Evaluation>('evaluations');
registerCollection('Evaluations', Evaluations);

Meteor.startup(() => {
	if (Meteor.isServer) {
		Evaluations._ensureIndex({
			timestamp: 1
		});
	}
});

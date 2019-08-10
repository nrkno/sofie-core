import { Mongo } from 'meteor/mongo'
import { TransformedCollection } from '../typings/meteor'
import { Time, registerCollection } from '../lib'
import { Meteor } from 'meteor/meteor'
export interface Evaluation extends EvaluationBase {
	_id: string,
	userId: string,
	timestamp: Time,
}
export interface EvaluationBase {
	studioId: string,
	playlistId: string,
	answers: {
		[key: string]: string
	},
	snapshots?: Array<string>
}

export const Evaluations: TransformedCollection<Evaluation, Evaluation>
	= new Mongo.Collection<Evaluation>('evaluations')
registerCollection('Evaluations', Evaluations)

Meteor.startup(() => {
	if (Meteor.isServer) {
		Evaluations._ensureIndex({
			timestamp: 1
		})
	}
})

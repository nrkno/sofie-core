import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import { EvaluationsSecurity } from '../security/evaluations'
import { Evaluations, Evaluation } from '../../lib/collections/Evaluations'

Meteor.publish('evaluations', (selector) => {
	if (EvaluationsSecurity.allowReadAccess({}, this)) {
		return Evaluations.find(selector)
	}
	return this.ready()
})

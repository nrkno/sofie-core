import { Evaluations, EvaluationBase } from '../../lib/collections/Evaluations'
import { getCurrentTime } from '../../lib/lib'
import { logger } from '../logging'
import { Meteor } from 'meteor/meteor'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import { RunningOrders } from '../../lib/collections/RunningOrders'
import { sendSlackMessageToWebhookSync } from './integration/slack'
import * as _ from 'underscore'

export function saveEvaluation (evaluation: EvaluationBase): void {
	Evaluations.insert(_.extend(evaluation, {
		userId: this.userId,
		timestamp: getCurrentTime(),
	}))
	logger.info({
		message: 'evaluation',
		evaluation: evaluation
	})

	Meteor.defer(() => {

		let studio = StudioInstallations.findOne(evaluation.studioId)
		if (!studio) throw new Meteor.Error(500, `Studio ${evaluation.studioId} not found!`)

		let webhookUrls = _.compact((studio.getConfigValue('slack_evaluation') + '').split(','))

		if (webhookUrls.length) {
			// Only send notes if not everything is OK
			let evaluationLevel = _.find(evaluation.answers, (_answer, key) => {
				return key === 'q0'
			})
			let evaluationMessage = _.find(evaluation.answers, (_answer, key) => {
				return key === 'q1'
			})
			let evaluationProducer = _.find(evaluation.answers, (_answer, key) => {
				return key === 'q2'
			})

			let slackMessage = 'Evaluation!'
			switch (evaluationLevel) {
				case 'nothing':
				slackMessage = 'Hey!'
					break;
				case 'minor':
				slackMessage = 'Ehm!'
					break;
				case 'major':
				slackMessage = 'Uh-oh!'
					break;
			}
			
			// only send message for evaluations with content
			if (evaluationMessage) {
				let ro = RunningOrders.findOne(evaluation.runningOrderId)

				slackMessage += ' From rundown "' + (ro ? ro.name : '' ) + '": \n' +
					evaluationMessage + '\n\n' + 
					evaluationProducer

				let hostUrl = studio.settings.sofieUrl
				if (hostUrl && ro) {
					slackMessage += '\n<' + hostUrl + '/ro/' + ro._id + '|' + ro.name + '>'
				}

				_.each(webhookUrls, (webhookUrl) => {
					sendSlackMessageToWebhookSync(slackMessage, webhookUrl)
				})
			}
		}
	})
}

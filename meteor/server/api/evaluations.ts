import { Evaluations, EvaluationBase } from '../../lib/collections/Evaluations'
import { ClientAPI } from '../../lib/api/client'
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
			let q0 = _.find(evaluation.answers, (_answer, key) => {
				return key === 'q0'
			})
			let q1 = _.find(evaluation.answers, (_answer, key) => {
				return key === 'q1'
			})

			let message = 'Evaluation!"'
			switch (q0) {
				case 'nothing':
					message = 'Hey!'
					break;
				case 'minor':
					message = 'Ehm!'
					break;
				case 'major':
					message = 'Uh-oh!'
					break;
			}

			if (q1) {

				let ro = RunningOrders.findOne(evaluation.runningOrderId)

				message =+ ' From rundown "' + (ro ? ro.name : '' ) + '": \n' +
					_.values(evaluation.answers).join(', ')

				let hostUrl = studio.settings.sofieUrl
				if (hostUrl && ro) {
					message += '\n<' + hostUrl + '/ro/' + ro._id + '|' + ro.name + '>'
				}

				_.each(webhookUrls, (webhookUrl) => {
					sendSlackMessageToWebhookSync(message, webhookUrl)
				})
			}

			// log for statistics
			if(q0) {
				logger.info(q0)
			}

		}
	})
}

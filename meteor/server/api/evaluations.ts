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
					slackMessage = ':heavy_check_mark: Feedback from '
					break
				case 'minor':
					slackMessage = ':grey_question: Minor issues with '
					break
				case 'major':
					slackMessage = ':warning: Major issues (affecting playout) in '
					break
			}

			// only send message for evaluations with content
			if (evaluationMessage) {
				let ro = RunningOrders.findOne(evaluation.runningOrderId)
				let hostUrl = studio.settings.sofieUrl

				slackMessage += (
					'rundown ' +
					(
						hostUrl && ro ?
						('*<' + hostUrl + '/ro/' + ro._id + '|' + ro.name + '>*') :
						(ro && ro.name || 'N/A')
					) +
					(hostUrl ? ' in ' + hostUrl : '' ) + '\n' +
					evaluationMessage + '\n' +
					'/_' + evaluationProducer + '_'
				)

				_.each(webhookUrls, (webhookUrl) => {
					sendSlackMessageToWebhookSync(slackMessage, webhookUrl)
				})
			}
		}
	})
}

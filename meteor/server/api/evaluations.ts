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
	Meteor.defer(() => {

		let studio = StudioInstallations.findOne(evaluation.studioId)
		if (!studio) throw new Meteor.Error(500, `Studio ${evaluation.studioId} not found!`)

		let webhookUrl = (studio.getConfigValue('slack_evaluation') + '')

		if (webhookUrl) {
			// Only send notes if not everything is OK
			let q0 = _.find(evaluation.answers, (_answer, key) => {
				return key === 'q0'
			})

			if (q0 !== 'nothing') {

				let ro = RunningOrders.findOne(evaluation.runningOrderId)

				let message = 'Uh-oh, message from RunningOrder "' + (ro ? ro.name : 'N/A' ) + '": \n' +
					_.values(evaluation.answers).join(', ')

				let hostUrl = studio.settings.sofieUrl
				if (hostUrl && ro) {
					message += '\n<' + hostUrl + '/ro/' + ro._id + '|' + ro.name + '>'
				}

				sendSlackMessageToWebhookSync(message, webhookUrl)
			}

		}
	})
}

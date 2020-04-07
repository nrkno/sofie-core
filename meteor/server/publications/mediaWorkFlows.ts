import { check } from 'meteor/check'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { MediaWorkFlowsSecurity, MediaWorkFlowStepsSecurity } from '../security/collections/mediaWorkFlows'
import { MediaWorkFlows } from '../../lib/collections/MediaWorkFlows'
import { MediaWorkFlowSteps } from '../../lib/collections/MediaWorkFlowSteps'

meteorPublish(PubSub.mediaWorkFlowSteps, (selector, token) => {
	selector = selector || {}
	check(selector, Object)

	if (MediaWorkFlowStepsSecurity.allowReadAccess(selector, token, this)) {
		// TODO: require deviceId
		return MediaWorkFlowSteps.find(selector)
	}
	return null
})

meteorPublish(PubSub.mediaWorkFlows, (selector, token) => {
	selector = selector || {}
	check(selector, Object)

	if (MediaWorkFlowsSecurity.allowReadAccess(selector, token, this)) {
		// TODO: require deviceId
		return MediaWorkFlows.find(selector)
	}
	return null
})

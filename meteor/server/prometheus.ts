import { Meteor } from 'meteor/meteor'
import { setupPrometheusMetrics } from '@sofie-automation/corelib/dist/prometheus'

Meteor.startup(() => {
	setupPrometheusMetrics('meteor')
})

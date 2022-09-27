import { Meteor } from 'meteor/meteor'
import { systemTime } from '../../../lib/lib'
import { performance } from 'perf_hooks'

Meteor.startup(() => {
	// Since we currently don't set any diff in systemTime and just use the parent OS's time,
	// we just set these to zero:

	systemTime.diff = 0
	systemTime.stdDev = 0
	systemTime.lastSync = performance.now()
	systemTime.hasBeenSet = true
})

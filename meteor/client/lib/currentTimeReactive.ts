import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import { getCurrentTime, Time } from '../../lib/lib'

let getCurrentTimeReactiveDep = new Tracker.Dependency()
export function getCurrentTimeReactive(): Time {
	getCurrentTimeReactiveDep.depend()
	return getCurrentTime()
}
let updateCurrentTimeReactive = () => {
	let time = getCurrentTime()

	getCurrentTimeReactiveDep.changed()

	let timeToNextSecond = Math.floor(1000 - (time % 1000))
	if (timeToNextSecond < 200) timeToNextSecond += 1000

	setTimeout(() => {
		updateCurrentTimeReactive()
	}, timeToNextSecond)
}
Meteor.startup(() => {
	updateCurrentTimeReactive()
})

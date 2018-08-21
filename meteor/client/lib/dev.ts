import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceCommands } from '../../lib/collections/PeripheralDeviceCommands'
import { Tasks } from '../../lib/collections/Tasks'
import { RunningOrders } from '../../lib/collections/RunningOrders'
import { SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { SegmentLines } from '../../lib/collections/SegmentLines'
import { Segments } from '../../lib/collections/Segments'
import { ShowStyles } from '../../lib/collections/ShowStyles'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import { Timeline } from '../../lib/collections/Timeline'
import { RuntimeFunctions } from '../../lib/collections/RuntimeFunctions'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { getCurrentTime } from '../../lib/lib'
import { MediaObjects } from '../../lib/collections/MediaObjects'
import { SegmentLineAdLibItems } from '../../lib/collections/SegmentLineAdLibItems'
import { RunningOrderBaselineAdLibItems } from '../../lib/collections/RunningOrderBaselineAdLibItems'
import { RunningOrderDataCache } from '../../lib/collections/RunningOrderDataCache'
import { RunningOrderBaselineItems } from '../../lib/collections/RunningOrderBaselineItems'
import { RuntimeFunctionDebugData } from '../../lib/collections/RuntimeFunctionDebugData'
import { Session } from 'meteor/session'
import { ExternalMessageQueue } from '../../lib/collections/ExternalMessageQueue'
import * as _ from 'underscore'

// Note: These things are convenience functions to be used during development

const Collections = {
	Tasks,
	PeripheralDevices,
	PeripheralDeviceCommands,
	RunningOrders,
	SegmentLineItems,
	SegmentLines,
	Segments,
	ShowStyles,
	StudioInstallations,
	RuntimeFunctions,
	Timeline,
	MediaObjects,
	SegmentLineAdLibItems,
	RunningOrderBaselineAdLibItems,
	RunningOrderDataCache,
	RunningOrderBaselineItems,
	RuntimeFunctionDebugData,
	ExternalMessageQueue
}

_.each(Collections, (val, key) => {
	window[key] = val
})

window['executeFunction'] = PeripheralDeviceAPI.executeFunction,
window['getCurrentTime'] = getCurrentTime
window['Session'] = Session

function setDebugData () {
	Tracker.autorun(() => {
		let stats: any = {}
		_.each(Collections, (collection: any, name: string) => {
			stats[name] = collection.find().count()
		})
		console.log(_.map(stats, (count: any, name: string) => { return name + ': ' + count }).join('\n'))
	})
}
window['setDebugData'] = setDebugData
const debugData = false
if (debugData) {
	console.log('Debug: comment out this!')
	setDebugData()
}

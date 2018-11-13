import { Meteor } from 'meteor/meteor'
// @ts-ignore Meteor package not recognized by Typescript
import { Picker } from 'meteor/meteorhacks:picker'
import { ServerResponse, IncomingMessage } from 'http'
import { StudioInstallation, StudioInstallations } from '../../lib/collections/StudioInstallations'
import { Snapshots, Snapshot, SnapshotRunningOrder, SnapshotType, SnapshotSystem } from '../../lib/collections/Snapshots'
import { RunningOrders, RunningOrder } from '../../lib/collections/RunningOrders'
import { RunningOrderDataCache, RunningOrderDataCacheObj } from '../../lib/collections/RunningOrderDataCache'
import { UserActionsLog, UserActionsLogItem } from '../../lib/collections/UserActionsLog'
import { Segments, Segment } from '../../lib/collections/Segments'
import { SegmentLineItems, SegmentLineItem } from '../../lib/collections/SegmentLineItems'
import { SegmentLineAdLibItems, SegmentLineAdLibItem } from '../../lib/collections/SegmentLineAdLibItems'
import { MediaObjects } from '../../lib/collections/MediaObjects'
import { getCurrentTime, Time } from '../../lib/lib'
import { ShowStyles, ShowStyle } from '../../lib/collections/ShowStyles'
import { PeripheralDevices, PeripheralDevice } from '../../lib/collections/PeripheralDevices'

export function createSnapshot (runningOrderId: number) {
	
}

interface RunningOrderSnapshot {
	snapshot: SnapshotRunningOrder
	runningOrder: RunningOrder
	mosData: Array<RunningOrderDataCacheObj>
	userActions: Array<UserActionsLogItem>
	segments: Array<Segment>
	segmentLineItems: Array<SegmentLineItem>
	segmentLineAdLibItems: Array<SegmentLineAdLibItem>
	mediaObjects
}

/**
 * Create a snapshot of all items related to a runningOrder
 * @param runningOrderId
 */
function createRunningOrderSnapshot (runningOrderId: string): RunningOrderSnapshot {
	const runningOrder = RunningOrders.findOne(runningOrderId)
	if (!runningOrder) throw new Meteor.Error(404,`RunningOrder ${runningOrderId} not found`)
	const mosData = RunningOrderDataCache.find({ roId: runningOrderId }, { sort: { modified: -1 } }).fetch() // @todo: check sorting order
	const userActions = UserActionsLog.find({ args: { $regex: `.*"${runningOrderId}".*` } }).fetch()

	const segments = Segments.find({ runningOrderId }).fetch()
	const segmentLineItems = SegmentLineItems.find({ runningOrderId }).fetch()
	const segmentLineAdLibItems = SegmentLineAdLibItems.find({ runningOrderId }).fetch()
	const mediaObjectIds: Array<string> = [
		...segmentLineItems.filter(item => item.content && item.content.fileName).map((item) => (item.content!.fileName! as string)),
		...segmentLineAdLibItems.filter(item => item.content && item.content.fileName).map((item) => (item.content!.fileName! as string))
	]
	const mediaObjects = MediaObjects.find({ mediaId: { $in: mediaObjectIds } }).fetch()

	return {
		snapshot: {
			created: getCurrentTime(),
			type: SnapshotType.RUNNING_ORDER,
			runningOrderId: runningOrderId,
			studioId: runningOrder.studioInstallationId
		},
		runningOrder,
		mosData,
		userActions,
		segments,
		segmentLineItems,
		segmentLineAdLibItems,
		mediaObjects
	}
}
interface SystemSnapshot {
	snapshot: SnapshotSystem
	studios: Array<StudioInstallation>
	showStyles: Array<ShowStyle>
	devices: Array<PeripheralDevice>
}
/**
 * Create a snapshot of all items related to the base system (all settings),
 * that means all studios, showstyles, peripheralDevices etc
 * @param runningOrderId
 */
function createSystemSnapshot () {
	const studios = StudioInstallations.find().fetch()
	const showStyles = ShowStyles.find().fetch()
	const devices = PeripheralDevices.find().fetch()

	return {
		snapshot: {
			created: getCurrentTime()
		},
		studios,
		showStyles,
		devices
	}
}

function createDebugSnapshot (studioId: string) {

}

// Setup endpoints:
Picker.route('/snapshot/runningOrder/:roId', (params, req: IncomingMessage, res: ServerResponse, next) => {
	
	
	let snapshot = getSystemSnapshot(params.studioId)

	res.setHeader('Content-Type', 'application/json')
	res.setHeader('Content-Disposition', `attachment; filename="${snapshot.snapshotId + '_' + snapshot.timestampStart}.json"`)

	let content = JSON.stringify(snapshot, null, 4)
	res.end(content)
})

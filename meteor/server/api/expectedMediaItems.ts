import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { ExpectedMediaItems, ExpectedMediaItem } from '../../lib/collections/ExpectedMediaItems'
import { RunningOrders } from '../../lib/collections/RunningOrders'
import { SegmentLineItems, SegmentLineItemGeneric } from '../../lib/collections/SegmentLineItems'
import { RunningOrderBaselineAdLibItems } from '../../lib/collections/RunningOrderBaselineAdLibItems'
import { SegmentLineAdLibItems } from '../../lib/collections/SegmentLineAdLibItems'
import { syncFunctionIgnore } from '../codeControl'
import { saveIntoDb, literal, getCurrentTime } from '../../lib/lib'
import { SegmentLines } from '../../lib/collections/SegmentLines'
import { wrapMethods, setMeteorMethods } from '../methods'
import { Random } from 'meteor/random'

export const updateExpectedMediaItems: (roId: string, slId: string) => void
= syncFunctionIgnore(function updateExpectedMediaItems (roId: string, slId: string) {
	check(roId, String)
	check(slId, String)

	const ro = RunningOrders.findOne(roId)
	if (!ro) throw new Meteor.Error(404, `RunningOrder "${roId}" not found.`)
	const studioInstallationId = ro.studioInstallationId

	const sl = SegmentLines.findOne(slId)
	if (!sl) throw new Meteor.Error(404, `SegmentLine "${slId}" not found.`)

	const eMIs: ExpectedMediaItem[] = []

	// const robalis = RunningOrderBaselineAdLibItems.find({
	// 	runningOrderId: ro._id
	// })
	const slis = SegmentLineItems.find({
		runningOrderId: ro._id
	})
	const slali = SegmentLineAdLibItems.find({
		runningOrderId: ro._id
	})

	function iterateOnSLILike (doc: SegmentLineItemGeneric, prefix: string) {
		if (doc.content && doc.content.fileName && doc.content.mediaFlowIds) {
			(doc.content.mediaFlowIds as string[]).forEach((flow) => {
				eMIs.push(literal<ExpectedMediaItem>({
					_id: prefix + '_' + doc._id + '_' + flow,
					disabled: false,
					lastSeen: getCurrentTime(),
					mediaFlowId: flow,
					path: this.toString(),

					runningOrderId: roId,
					segmentLineId: slId,
					studioInstallationId: studioInstallationId
				}))
			}, doc.content.fileName)
		}
	}

	// robalis.forEach((doc) => iterateOnSLILike(doc, 'robali'))
	slis.forEach((doc) => iterateOnSLILike(doc, 'sli'))
	slali.forEach((doc) => iterateOnSLILike(doc, 'slali'))

	saveIntoDb<ExpectedMediaItem, ExpectedMediaItem>(ExpectedMediaItems, {
		runningOrderId: ro._id,
		segmentLineId: sl._id
	}, eMIs)
})

function insertExpectedObject (fileName: string, mediaFlowId: string, runningOrderId: string, segmentLineId: string) {
	const ro = RunningOrders.findOne(runningOrderId)
	if (!ro) throw new Meteor.Error(404, `RunningOrder "${runningOrderId}" not found.`)

	ExpectedMediaItems.insert({
		_id: Random.id(),
		disabled: false,
		lastSeen: getCurrentTime(),
		mediaFlowId: mediaFlowId,
		path: fileName,
		runningOrderId,
		segmentLineId,
		studioInstallationId: ro.studioInstallationId
	})
}

let methods = {}
methods['insertExpected'] = (fileName, mediaFlowId, runningOrderId, segmentLineId) => {
	return insertExpectedObject(fileName, mediaFlowId, runningOrderId, segmentLineId)
}

// Apply methods:
setMeteorMethods(wrapMethods(methods))

import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { ExpectedMediaItems, ExpectedMediaItem } from '../../lib/collections/ExpectedMediaItems'
import { RunningOrders } from '../../lib/collections/RunningOrders'
import { SegmentLineItems, SegmentLineItemGeneric } from '../../lib/collections/SegmentLineItems'
import { RunningOrderBaselineAdLibItems } from '../../lib/collections/RunningOrderBaselineAdLibItems'
import { SegmentLineAdLibItems } from '../../lib/collections/SegmentLineAdLibItems'
import { syncFunctionIgnore } from '../codeControl'
import { saveIntoDb, literal, getCurrentTime } from '../../lib/lib'
import { RunningOrderBaselineItems } from '../../lib/collections/RunningOrderBaselineItems';

export const updateExpectedMediaItems: (roId: string) => void
= syncFunctionIgnore(function updateExpectedMediaItems (roId: string) {
	check(roId, String)

	const ro = RunningOrders.findOne(roId)
	if (!ro) throw new Meteor.Error(404, `RunningOrder "${roId}" not found.`)

	const eMIs: ExpectedMediaItem[] = []

	const slis = SegmentLineItems.find({
		runningOrderId: ro._id
	})
	const robalis = RunningOrderBaselineAdLibItems.find({
		runningOrderId: ro._id
	})
	const slali = SegmentLineAdLibItems.find({
		runningOrderId: ro._id
	})
	

	function iterateOnSLILike (doc: SegmentLineItemGeneric, prefix: string) {
		if (doc.content && doc.content.fileName && doc.content.mediaFlowId) {
			eMIs.push(literal<ExpectedMediaItem>({
				_id: prefix + '_' + doc._id,
				disabled: false,
				lastSeen: getCurrentTime(),
				mediaFlowId: doc.content.mediaFlowId as string,
				path: doc.content.fileName as string,
				runningOrderId: roId
			}))
		}
	}

	robalis.forEach((doc) => iterateOnSLILike(doc, 'robali'))
	slis.forEach((doc) => iterateOnSLILike(doc, 'sli'))
	slali.forEach((doc) => iterateOnSLILike(doc, 'slali'))

	saveIntoDb<ExpectedMediaItem, ExpectedMediaItem>(ExpectedMediaItems, {
		runningOrderId: ro._id
	}, eMIs)
})

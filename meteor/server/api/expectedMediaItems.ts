import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { ExpectedMediaItems, ExpectedMediaItem } from '../../lib/collections/ExpectedMediaItems'
import { Rundowns } from '../../lib/collections/Rundowns'
import { SegmentLineItems, SegmentLineItemGeneric } from '../../lib/collections/SegmentLineItems'
import { SegmentLineAdLibItems } from '../../lib/collections/SegmentLineAdLibItems'
import { syncFunctionIgnore } from '../codeControl'
import { saveIntoDb, literal, getCurrentTime, getHash } from '../../lib/lib'
import { SegmentLines } from '../../lib/collections/SegmentLines'
import { setMeteorMethods } from '../methods'
import { Random } from 'meteor/random'
import { logger } from '../logging'

export const updateExpectedMediaItems: (rundownId: string, slId: string) => void
= syncFunctionIgnore(function updateExpectedMediaItems (rundownId: string, slId: string) {
	check(rundownId, String)
	check(slId, String)

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) {
		const removedItems = ExpectedMediaItems.remove({
			rundownId: rundownId
		})
		logger.info(`Removed ${removedItems} expected media items for deleted rundown "${rundownId}"`)
		return
	}
	const studioInstallationId = rundown.studioInstallationId

	const sl = SegmentLines.findOne(slId)
	if (!sl) {
		const removedItems = ExpectedMediaItems.remove({
			rundownId: rundownId,
			segmentLineId: slId
		})
		logger.info(`Removed ${removedItems} expected media items for deleted segmentLine "${slId}"`)
		return
	}

	const eMIs: ExpectedMediaItem[] = []

	// const robalis = RundownBaselineAdLibItems.find({
	// 	rundownId: rundown._id
	// })
	const slis = SegmentLineItems.find({
		rundownId: rundown._id,
		segmentLineId: sl._id
	})
	const slali = SegmentLineAdLibItems.find({
		rundownId: rundown._id,
		segmentLineId: sl._id
	})

	function iterateOnSLILike (doc: SegmentLineItemGeneric, prefix: string) {
		if (doc.content && doc.content.fileName && doc.content.path && doc.content.mediaFlowIds) {
			(doc.content.mediaFlowIds as string[]).forEach(function (flow) {
				eMIs.push(literal<ExpectedMediaItem>({
					_id: getHash(prefix + '_' + doc._id + '_' + flow + '_' + rundownId + '_' + slId),
					disabled: false,
					lastSeen: getCurrentTime(),
					mediaFlowId: flow,
					path: this[0].toString(),
					url: this[1].toString(),

					rundownId: rundownId,
					segmentLineId: slId,
					studioInstallationId: studioInstallationId
				}))
			}, [doc.content.fileName, doc.content.path])
		}
	}

	// robalis.forEach((doc) => iterateOnSLILike(doc, 'robali'))
	slis.forEach((doc) => iterateOnSLILike(doc, 'sli'))
	slali.forEach((doc) => iterateOnSLILike(doc, 'slali'))

	saveIntoDb<ExpectedMediaItem, ExpectedMediaItem>(ExpectedMediaItems, {
		rundownId: rundown._id,
		segmentLineId: sl._id
	}, eMIs)
})

function insertExpectedObject (fileName: string, url: string, mediaFlowId: string, rundownId: string, segmentLineId: string) {
	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) throw new Meteor.Error(404, `Rundown "${rundownId}" not found.`)

	ExpectedMediaItems.insert({
		_id: Random.id(),
		disabled: false,
		lastSeen: getCurrentTime(),
		mediaFlowId: mediaFlowId,
		path: fileName,
		url,
		rundownId,
		segmentLineId,
		studioInstallationId: rundown.studioInstallationId
	})
}

let methods = {}
methods['insertExpected'] = (fileName, url, mediaFlowId, rundownId, segmentLineId) => {
	return insertExpectedObject(fileName, url, mediaFlowId, rundownId, segmentLineId)
}

// Apply methods:
setMeteorMethods(methods)

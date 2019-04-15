import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { ExpectedMediaItems, ExpectedMediaItem } from '../../lib/collections/ExpectedMediaItems'
import { Rundowns } from '../../lib/collections/Rundowns'
import { Pieces, PieceGeneric } from '../../lib/collections/Pieces'
import { AdLibPieces } from '../../lib/collections/AdLibPieces'
import { syncFunctionIgnore } from '../codeControl'
import { saveIntoDb, literal, getCurrentTime, getHash } from '../../lib/lib'
import { Parts } from '../../lib/collections/Parts'
import { setMeteorMethods } from '../methods'
import { Random } from 'meteor/random'
import { logger } from '../logging'

export const updateExpectedMediaItems: (rundownId: string, partId: string) => void
= syncFunctionIgnore(function updateExpectedMediaItems (rundownId: string, partId: string) {
	check(rundownId, String)
	check(partId, String)

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) {
		const removedItems = ExpectedMediaItems.remove({
			rundownId: rundownId
		})
		logger.info(`Removed ${removedItems} expected media items for deleted rundown "${rundownId}"`)
		return
	}
	const studioId = rundown.studioId

	const part = Parts.findOne(partId)
	if (!part) {
		const removedItems = ExpectedMediaItems.remove({
			rundownId: rundownId,
			partId: partId
		})
		logger.info(`Removed ${removedItems} expected media items for deleted part "${partId}"`)
		return
	}

	const eMIs: ExpectedMediaItem[] = []

	// const robalis = RundownBaselineAdLibPieces.find({
	// 	rundownId: rundown._id
	// })
	const slis = Pieces.find({
		rundownId: rundown._id,
		partId: part._id
	})
	const slali = AdLibPieces.find({
		rundownId: rundown._id,
		partId: part._id
	})

	function iterateOnPieceLike (doc: PieceGeneric, prefix: string) {
		if (doc.content && doc.content.fileName && doc.content.path && doc.content.mediaFlowIds) {
			(doc.content.mediaFlowIds as string[]).forEach(function (flow) {
				eMIs.push(literal<ExpectedMediaItem>({
					_id: getHash(prefix + '_' + doc._id + '_' + flow + '_' + rundownId + '_' + partId),
					disabled: false,
					lastSeen: getCurrentTime(),
					mediaFlowId: flow,
					path: this[0].toString(),
					url: this[1].toString(),

					rundownId: rundownId,
					partId: partId,
					studioId: studioId
				}))
			}, [doc.content.fileName, doc.content.path])
		}
	}

	// robalis.forEach((doc) => iterateOnPieceLike(doc, 'robali'))
	slis.forEach((doc) => iterateOnPieceLike(doc, 'piece'))
	slali.forEach((doc) => iterateOnPieceLike(doc, 'slali'))

	saveIntoDb<ExpectedMediaItem, ExpectedMediaItem>(ExpectedMediaItems, {
		rundownId: rundown._id,
		partId: part._id
	}, eMIs)
})

function insertExpectedObject (fileName: string, url: string, mediaFlowId: string, rundownId: string, partId: string) {
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
		partId,
		studioId: rundown.studioId
	})
}

let methods = {}
methods['insertExpected'] = (fileName, url, mediaFlowId, rundownId, partId) => {
	return insertExpectedObject(fileName, url, mediaFlowId, rundownId, partId)
}

// Apply methods:
setMeteorMethods(methods)

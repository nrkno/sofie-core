import { check } from 'meteor/check'
import { Meteor } from 'meteor/meteor'
import { ExpectedMediaItems, ExpectedMediaItem } from '../../lib/collections/ExpectedMediaItems'
import { Rundowns } from '../../lib/collections/Rundowns'
import { Pieces, PieceGeneric } from '../../lib/collections/Pieces'
import { AdLibPieces } from '../../lib/collections/AdLibPieces'
import { syncFunctionIgnore } from '../codeControl'
import { saveIntoDb, getCurrentTime, getHash } from '../../lib/lib'
import { Parts } from '../../lib/collections/Parts'
import { setMeteorMethods } from '../methods'
import { Random } from 'meteor/random'
import { logger } from '../logging'

export enum PieceType {
	PIECE = 'piece',
	ADLIB = 'adlib'
}

function generateExpectedMediaItems (rundownId: string, studioId: string, piece: PieceGeneric, pieceType: string): ExpectedMediaItem[] {
	const result: ExpectedMediaItem[] = []

	if (piece.content && piece.content.fileName && piece.content.path && piece.content.mediaFlowIds && piece.partId) {
		(piece.content.mediaFlowIds as string[]).forEach(function (flow) {
			const id = getHash(pieceType + '_' + piece._id + '_' + flow + '_' + rundownId + '_' + piece.partId)
			result.push({
				_id: id,
				label: piece.name,
				disabled: false,
				lastSeen: getCurrentTime(),
				mediaFlowId: flow,
				path: this[0].toString(),
				url: this[1].toString(),

				rundownId: rundownId,
				partId: piece.partId as string,
				studioId: studioId
			})
		}, [piece.content.fileName, piece.content.path])
	}

	return result
}

export const updateExpectedMediaItemsOnRundown: (rundownId: string) => void 
= syncFunctionIgnore(function updateExpectedMediaItemsOnRundown (rundownId: string) {
	check(rundownId, String)

	const rundown = Rundowns.findOne(rundownId)
	if (!rundown) {
		const removedItems = ExpectedMediaItems.remove({
			rundownId: rundownId
		})
		logger.info(`Removed ${removedItems} expected media items for deleted rundown "${rundownId}"`)
		return
	}
	const studioId = rundown.studioId

	const pieces = Pieces.find({
		rundownId: rundown._id
	}).fetch()
	const adlibs = AdLibPieces.find({
		rundownId: rundown._id
	}).fetch()

	const eMIs: ExpectedMediaItem[] = []

	function iterateOnPieceLike (piece: PieceGeneric, pieceType: string) {
		eMIs.push(...generateExpectedMediaItems(rundownId, studioId, piece, pieceType))
	}

	// robalis.forEach((doc) => iterateOnPieceLike(doc, 'robali'))
	pieces.forEach((doc) => iterateOnPieceLike(doc, PieceType.PIECE))
	adlibs.forEach((doc) => iterateOnPieceLike(doc, PieceType.ADLIB))

	saveIntoDb<ExpectedMediaItem, ExpectedMediaItem>(ExpectedMediaItems, {
		rundownId: rundown._id
	}, eMIs)
})

export const updateExpectedMediaItemsOnPart: (rundownId: string, partId: string) => void
= syncFunctionIgnore(function updateExpectedMediaItemsOnPart (rundownId: string, partId: string) {
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
	const pieces = Pieces.find({
		rundownId: rundown._id,
		partId: part._id
	})
	const adlibs = AdLibPieces.find({
		rundownId: rundown._id,
		partId: part._id
	})

	function iterateOnPieceLike (piece: PieceGeneric, pieceType: string) {
		eMIs.push(...generateExpectedMediaItems(rundownId, studioId, piece, pieceType))
	}

	// robalis.forEach((doc) => iterateOnPieceLike(doc, 'robali'))
	pieces.forEach((doc) => iterateOnPieceLike(doc, PieceType.PIECE))
	adlibs.forEach((doc) => iterateOnPieceLike(doc, PieceType.ADLIB))

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

import { Meteor } from 'meteor/meteor'
import { check } from 'meteor/check'
import * as _ from 'underscore'

import * as MOS from 'mos-connection'

import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import {
	PeripheralDevices,
	PeripheralDevice
} from '../../../lib/collections/PeripheralDevices'
import {
	Rundown,
	Rundowns,
	DBRundown
} from '../../../lib/collections/Rundowns'
import {
	Part,
	Parts,
	DBPart
} from '../../../lib/collections/Parts'
import {
	Piece,
	Pieces
} from '../../../lib/collections/Pieces'
import {
	saveIntoDb,
	getCurrentTime,fetchBefore,
	getRank,
	fetchAfter,
	literal,
	getHash
} from '../../../lib/lib'
import { PeripheralDeviceSecurity } from '../../security/peripheralDevices'
import { logger } from '../../logging'

import {
	Studios,
	Studio
} from '../../../lib/collections/Studios'
import {
	AdLibPiece,
	AdLibPieces
} from '../../../lib/collections/AdLibPieces'
import {
	ShowStyleBases
} from '../../../lib/collections/ShowStyleBases'
import {
	ServerPlayoutAPI,
	updateTimelineFromMosData
} from '../playout'
import {
	setMeteorMethods,
	Methods
} from '../../methods'
import {
	afterRemovePart,
	updateSegments,
	updateAffectedParts,
	removePart,
	runPostProcessBlueprint,
	ServerRundownAPI,
	selectShowStyleVariant
} from '../rundown'
import { syncFunction } from '../../codeControl'
import { IBlueprintPart, PartHoldMode, IngestRundown, IngestPart, IngestSegment } from 'tv-automation-sofie-blueprints-integration'
import { updateExpectedMediaItems } from '../expectedMediaItems'
import { Blueprint, Blueprints } from '../../../lib/collections/Blueprints'
import { PartNote, NoteType } from '../../../lib/api/notes'
import { loadShowStyleBlueprints } from '../blueprints/cache'
import { postProcessAdLibPieces, postProcessPieces, postProcessPartBaselineItems } from '../blueprints/postProcess'
import { ShowStyleContext, RundownContext } from '../blueprints/context'
import { RundownBaselineItem, RundownBaselineItems } from '../../../lib/collections/RundownBaselineItems'
import { Random } from 'meteor/random'
import { RundownBaselineAdLibItem, RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { getRundownId, getStudio, getPartId, updateDeviceLastDataReceived } from '../ingest/lib'
import { handleUpdatedRundown } from '../ingest/rundownInput';
import { IngestDataCache } from '../../../lib/collections/IngestDataCache';
const PackageInfo = require('../../../package.json')

function getMosRundownId (studio: Studio, mosId: MOS.MosString128) {
	if (!mosId) throw new Meteor.Error(401, 'parameter mosId missing!')
	return getRundownId(studio, mosId.toString())
}

function getMosPartId (rundownId: string, partMosId: MOS.MosString128) {
	if (!partMosId) throw new Meteor.Error(401, 'parameter partMosId missing!')
	return getPartId(rundownId, partMosId.toString())
}

/**
 * Returns a Rundown, throws error if not found
 * @param rundownId Id of the Rundown
 */
function getRO (studio: Studio, rundownID: MOS.MosString128): Rundown {
	let id = getMosRundownId(studio, rundownID)
	let rundown = Rundowns.findOne(id)
	if (rundown) {
		rundown.touch()
		return rundown
	} else throw new Meteor.Error(404, 'Rundown ' + id + ' not found (rundown: ' + rundownID + ')')
}
/**
 * Returns a Part (aka an Item), throws error if not found
 * @param rundownId
 * @param partId
 */
function getPart (studio: Studio, rundownID: MOS.MosString128, storyID: MOS.MosString128): Part {
	let id = getMosPartId(getMosRundownId(studio, rundownID), storyID)
	let part = Parts.findOne({
		rundownId: getMosRundownId(studio, rundownID),
		_id: id
	})
	if (part) {
		return part
	} else {
		let rundown = getRO(studio, rundownID)
		if (rundown) {
			rundown.appendNote({
				type: NoteType.ERROR,
				message: 'There was an error when receiving MOS-data. This might be fixed by triggering a "Reload ENPS Data".',
				origin: {
					name: rundown.name,
					rundownId: rundown._id
				}
			})
		}
		throw new Meteor.Error(404, 'Part ' + id + ' not found (rundown: ' + rundownID + ', story: ' + storyID + ')')
	}
}

/**
 * Converts an Item into a Part
 * @param item MOS Item
 * @param rundownId Rundown id of the item
 * @param segmentId Segment / Story id of the item
 * @param rank Rank of the story
 */
function convertToPart (story: MOS.IMOSStory, rundownId: string, rank: number): DBPart {
	return {
		_id: getMosPartId(rundownId, story.ID),
		rundownId: rundownId,
		segmentId: '', // to be coupled later
		_rank: rank,
		externalId: story.ID.toString(),
		title: (story.Slug || '').toString(),
		typeVariant: ''
		// expectedDuration: item.EditorialDuration,
		// autoNext: item.Trigger === ??
	}
}
/**
 * Merge an old part with a new one (to be used together with (after) convertToPart )
 * @param newPart
 * @param existingPart
 */
function mergePart (newPart: DBPart, existingPart?: DBPart): DBPart {
	if (existingPart) {
		if (existingPart._id !== newPart._id) {
			throw new Meteor.Error(500, `mergePart: ids differ: ${newPart._id}, ${existingPart._id}`)
		}

		newPart = _.extend({}, existingPart, _.omit(newPart, ['segmentId']))

		newPart.typeVariant = existingPart.typeVariant || newPart.typeVariant // typeVariant is set in the blueprints
		newPart.subTypeVariant = existingPart.subTypeVariant || newPart.subTypeVariant // subTypeVariant is set in the blueprints
	}
	return newPart
}
/**
 * Insert a new Part (aka an Item)
 * @param item The item to be inserted
 * @param rundownId The id of the Rundown
 * @param segmentId The id of the Segment / Story
 * @param rank The new rank of the Part
 */
function upsertPart (story: MOS.IMOSStory, rundownId: string, rank: number): DBPart {
	let part = convertToPart(story, rundownId, rank)
	Parts.upsert(part._id, {$set: part}) // insert, or update
	afterInsertUpdatePart(story, rundownId)
	return part

}
function afterInsertUpdatePart (story: MOS.IMOSStory, rundownId: string) {
	// nothing
}

function fixIllegalObject (o: any) {
	if (_.isArray(o)) {
		_.each(o, (val, key) => {
			fixIllegalObject(val)
		})
	} else if (_.isObject(o)) {
		_.each(_.keys(o), (key: string) => {
			let val = o[key]
			if ((key + '').match(/^\$/)) {
				let newKey = key.replace(/^\$/,'@')
				o[newKey] = val
				delete o[key]
				key = newKey
			}
			fixIllegalObject(val)
		})
	}
}
function formatDuration (duration: any): number | undefined {
	try {
		// first try and parse it as a MOS.MosDuration timecode string
		return duration ? new MOS.MosDuration(duration.toString()).valueOf() * 1000 : undefined
	} catch (e) {
		try {
			// second try and parse it as a length in seconds
			return duration ? Number.parseFloat(duration) * 1000 : undefined
		} catch (e2) {
			logger.warn('Bad MOS.MosDuration: "' + duration + '"', e)
			return undefined
		}
	}
}
function formatTime (time: any): number | undefined {
	try {
		return time ? new MOS.MosTime(time.toString()).getTime() : undefined
	} catch (e) {
		logger.warn('Bad MOS.MosTime: "' + time + '"', e)
		return undefined
	}
}
export const updateStory: (rundown: Rundown, part: Part, story: MOS.IMOSROFullStory) => boolean
= syncFunction(function updateStory (rundown: Rundown, part: Part, story: MOS.IMOSROFullStory): boolean {
	let showStyleBase = ShowStyleBases.findOne(rundown.showStyleBaseId)
	if (!showStyleBase) throw new Meteor.Error(404, 'ShowStyleBase "' + rundown.showStyleBaseId + '" not found!')

	const context = new PartContext(rundown, part, story)
	context.handleNotesExternally = true

	let resultSl: IBlueprintPart | undefined = undefined
	let resultPiece: Piece[] | undefined = undefined
	let resultAdlibPiece: AdLibPiece[] | undefined = undefined
	let notes: PartNote[] = []
	try {
		const blueprints = loadShowStyleBlueprints(showStyleBase)
		let result = blueprints.getPart(context, story) // TODO: refactor this

 		if (result) {
			resultAdlibPiece = postProcessAdLibPieces(context, result.adLibItems, result.part.typeVariant, part._id)
			resultPiece = postProcessPieces(context, result.pieces, result.part.typeVariant, part._id)
			resultSl = result.part
		}

 		notes = context.getNotes()
	} catch (e) {
		logger.error(e.stack ? e.stack : e.toString())
		// throw e
		notes = [{
			type: NoteType.ERROR,
			origin: {
				name: '',				rundownId: context.rundown._id,
				segmentId: (context.part as DBPart).segmentId,
				partId: context.part._id,
			},
			message: 'Internal Server Error'
		}],
		resultPiece = undefined
		resultAdlibPiece = undefined
	}

	let changedPiece: {
		added: number,
		updated: number,
		removed: number
	} = {
		added: 0,
		updated: 0,
		removed: 0
	}
	if (resultSl) {
		Parts.update(part._id, {$set: {
			expectedDuration:		resultSl.expectedDuration || 0,
			notes: 					notes,
			autoNext: 				resultSl.autoNext || false,
			autoNextOverlap: 		resultSl.autoNextOverlap || 0,
			prerollDuration: 		resultSl.prerollDuration || 0,
			transitionDuration:				resultSl.transitionDuration,
			transitionPrerollDuration: 		resultSl.transitionPrerollDuration,
			transitionKeepaliveDuration: 	resultSl.transitionKeepaliveDuration,
			disableOutTransition: 	resultSl.disableOutTransition || false,
			updateStoryStatus:		resultSl.updateStoryStatus || false,
			typeVariant:			resultSl.typeVariant || '',
			subTypeVariant:			resultSl.subTypeVariant || '',
			holdMode: 				resultSl.holdMode || PartHoldMode.NONE,
			classes: 				resultSl.classes || [],
			classesForNext: 		resultSl.classesForNext || [],
			displayDurationGroup: 	resultSl.displayDurationGroup || '', // TODO - or unset?
			displayDuration: 		resultSl.displayDuration || 0, // TODO - or unset
			invalid: 				resultSl.invalid || false
		}})
	} else {
		Parts.update(part._id, {$set: {
			notes: notes,
			invalid: true
		}})
	}

	if (resultPiece) {
		changedPiece = saveIntoDb<Piece, Piece>(Pieces, {
			rundownId: rundown._id,
			partId: part._id,
			dynamicallyInserted: { $ne: true } // do not affect dynamically inserted items (such as adLib items)
		}, resultPiece || [], {
			afterInsert (piece) {
				logger.debug('inserted piece ' + piece._id)
				logger.debug(piece)
				// @todo: have something here?
				// let story: MOS.IMOSROStory | undefined = _.find(rundown.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
					// afterInsertUpdateSegment (story, rundownId(rundown.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterUpdate (piece) {
				logger.debug('updated piece ' + piece._id)
				// @todo: have something here?
				// let story: MOS.IMOSROStory | undefined = _.find(rundown.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
				// 	afterInsertUpdateSegment (story, rundownId(rundown.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterRemove (piece) {
				logger.debug('deleted piece ' + piece._id)
				// @todo: handle this:
				// afterRemovePiece(part._id)
			}
		})
	}
	if (resultAdlibPiece) {
		saveIntoDb<AdLibPiece, AdLibPiece>(AdLibPieces, {
			rundownId: rundown._id,
			partId: part._id,
			// fromPostProcess: { $ne: true }, // do not affect postProcess items
		}, resultAdlibPiece || [], {
			afterInsert (adLibPiece) {
				logger.debug('inserted adLibPiece ' + adLibPiece._id)
				logger.debug(adLibPiece)
				// @todo: have something here?
				// let story: MOS.IMOSROStory | undefined = _.find(rundown.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
				// afterInsertUpdateSegment (story, rundownId(rundown.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterUpdate (adLibPiece) {
				logger.debug('updated piece ' + adLibPiece._id)
				// @todo: have something here?
				// let story: MOS.IMOSROStory | undefined = _.find(rundown.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
				// 	afterInsertUpdateSegment (story, rundownId(rundown.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterRemove (adLibPiece) {
				logger.debug('deleted piece ' + adLibPiece._id)
				// @todo: handle this:
				// afterRemovePiece(part._id)
			}
		})
	}

	if (resultPiece || resultAdlibPiece) {
		try {
			updateExpectedMediaItems(rundown._id, part._id)
		} catch (e) {
			logger.error('Error updating expectedMediaItems: ' + e.toString())
		}
	}

	// if anything was changed
	return (changedPiece.added > 0 || changedPiece.removed > 0 || changedPiece.updated > 0)
	// return this.core.mosManipulate(P.methods.mosRoReadyToAir, story)
})

export function sendStoryStatus (rundown: Rundown, takePart: Part | null) {

	if (rundown.currentPlayingStoryStatus) {
		setStoryStatus(rundown.peripheralDeviceId, rundown, rundown.currentPlayingStoryStatus, MOS.IMOSObjectStatus.STOP)
		.catch(e => logger.error(e))
	}
	if (takePart) {
		setStoryStatus(rundown.peripheralDeviceId, rundown, takePart.externalId, MOS.IMOSObjectStatus.PLAY)
		.catch(e => logger.error(e))

		Rundowns.update(this._id, {$set: {
			currentPlayingStoryStatus: takePart.externalId
		}})
		rundown.currentPlayingStoryStatus = takePart.externalId
	} else {
		Rundowns.update(this._id, {$unset: {
			currentPlayingStoryStatus: 1
		}})
		delete rundown.currentPlayingStoryStatus
	}
}
function setStoryStatus (deviceId: string, rundown: Rundown, storyId: string, status: MOS.IMOSObjectStatus): Promise<any> {
	return new Promise((resolve, reject) => {
		if (!rundown.rehearsal) {
			logger.debug('setStoryStatus', deviceId, rundown.externalId, storyId, status)
			PeripheralDeviceAPI.executeFunction(deviceId, (err, result) => {
				logger.debug('reply', err, result)
				if (err) {
					reject(err)
				} else {
					resolve(result)
				}
			}, 'setStoryStatus', rundown.externalId, storyId, status)
		}
	})
}
export const reloadRundown: (rundown: Rundown) => void = Meteor.wrapAsync(
	function reloadRundown (rundown: Rundown, cb: (err: Error | null) => void) {
		logger.info('reloadRundown ' + rundown._id)

		if (!rundown.peripheralDeviceId) throw new Meteor.Error(400,'rundown.peripheralDeviceId missing!')
		check(rundown.peripheralDeviceId, String)

		const peripheralDevice = PeripheralDevices.findOne(rundown.peripheralDeviceId)
		if (!peripheralDevice) throw new Meteor.Error(404, 'PeripheralDevice "' + rundown.peripheralDeviceId + '" not found' )

		PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err: any, rundown: MOS.IMOSRunningOrder) => {
			// console.log('Response!')
			if (err) {
				logger.error(err)
				cb(err)
			} else {
				try {
					logger.info('triggerGetRundown reply ' + rundown.ID)
					logger.debug(rundown)

					handleRundownData(rundown, peripheralDevice, false)
					cb(null)
				} catch (e) {
					cb(e)
				}
			}
		}, 'triggerGetRundown', rundown.externalId)
	}
)
export function replaceStoryItem (rundown: Rundown, piece: Piece, partCache: {}, inPoint: number, duration: number) {
	return new Promise((resolve, reject) => {
		const story = partCache.data.Body.filter(item => item.Type === 'storyItem' && item.Content.ID === piece.externalId)[0].Content
		story.EditorialStart = inPoint
		story.EditorialDuration = duration

		const peripheralDevice = PeripheralDevices.findOne(rundown.peripheralDeviceId)
		if (!peripheralDevice) throw new Meteor.Error(404, 'PeripheralDevice "' + rundown.peripheralDeviceId + '" not found' )

		PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err?: any) => {
			if (err) reject(err)
			else resolve()
		}, 'replaceStoryItem', partCache.data.RundownId, partCache.data.ID, story)
	})
}

function handleRundownData (mosRundown: MOS.IMOSRunningOrder, peripheralDevice: PeripheralDevice, createFresh: boolean) {
	const studio = getStudio(peripheralDevice)

	// Create or update a rundown (ie from rundownCreate or rundownList)

	const rundownId = getMosRundownId(studio, mosRundown.ID)
	// const existingDbRundown = Rundowns.findOne(rundownId)
	// if (!isAvailableForMOS(existingDbRundown)) return
	// updateDeviceLastDataReceived(peripheralDevice._id)
	// logger.info((existingDbRundown ? 'Updating' : 'Adding') + ' rundown ' + rundownId)

	const stories = _.compact(_.map(mosRundown.Stories || [], (s, i) => {
		if (!s) return null

		const name = (s.Slug ? s.Slug.toString() : '')
		return {
			partId: getMosPartId(rundownId, s.ID),
			segmentName: name.split(';')[0],
			ingest: literal<IngestPart>({
				externalId: s.ID.toString(),
				name: name,
				rank: i,
				payload: createFresh ? {} : undefined,
			})
		}
	}))
	const groupedStories: { name: string, parts: IngestPart[]}[] = []
	_.each(stories, s => {
		const lastStory = _.last(groupedStories)
		if (lastStory && lastStory.name === s.segmentName) {
			lastStory.parts.push(s.ingest)
		} else {
			groupedStories.push({ name: s.segmentName, parts: [s.ingest]})
		}
	})

	// If this is a reload of a RO, then use cached data to make the change more seamless
	if (!createFresh) {
		const partIds = _.map(stories, s => s.partId) // TODO - or is this RAW ids?
		const partCache = IngestDataCache.find({
			rundownId: rundownId,
			partId: { $in: partIds }
		}).fetch()

		const partCacheMap: { [id: string]: IngestPart } = {}
		_.each(partCache, p => partCacheMap[p._id] = p.data)

		_.each(stories, s => {
			const cached = partCacheMap[s.partId]
			if (cached) {
				s.ingest.payload = cached.payload
			}
		})
	}

	const ingestSegments = _.map(groupedStories, (grp, i) => literal<IngestSegment>({
		externalId: `${mosRundown.ID}_${grp.name}`,
		name: grp.name,
		rank: i,
		parts: grp.parts,
	}))

	const ingestRundown = literal<IngestRundown>({
		externalId: mosRundown.ID.toString(),
		name: mosRundown.Slug.toString(),
		type: 'mos',
		segments: ingestSegments,
		payload: mosRundown
	})

	handleUpdatedRundown(peripheralDevice, ingestRundown, createFresh ? 'mosCreate' : 'mosList')

	// const showStyle = selectShowStyleVariant(studio, ingestRundown)
	// if (!showStyle) {
	// 	logger.warn('Studio blueprint rejected rundown')
	// 	return
	// }

	// const showStyleBlueprint = loadShowStyleBlueprints(showStyle.base)
	// const blueprintContext = new ShowStyleContext(studio, showStyle.base._id, showStyle.variant._id)
	// const rundownRes = showStyleBlueprint.getRundown(blueprintContext, ingestRundown)

	// let blueprint = Blueprints.findOne(showStyle.base.blueprintId) as Blueprint || {}

	// let dbROData: DBRundown = _.extend(existingDbRundown || {},
	// 	_.omit(literal<DBRundown>({
	// 		_id: getMosRundownId(studio, rundown.ID),
	// 		externalId: rundown.ID.toString(),
	// 		studioId: studio._id,
	// 		peripheralDeviceId: peripheralDevice._id,
	// 		showStyleVariantId: showStyle.variant._id,
	// 		showStyleBaseId: showStyle.base._id,
	// 		name: rundown.Slug.toString(),
	// 		expectedStart: formatTime(rundown.EditorialStart),
	// 		expectedDuration: formatDuration(rundown.EditorialDuration),
	// 		dataSource: dataSource,
	// 		unsynced: false,

	// 		importVersions: {
	// 			studio: studio._rundownVersionHash,
	// 			showStyleBase: showStyle.base._rundownVersionHash,
	// 			showStyleVariant: showStyle.variant._rundownVersionHash,
	// 			blueprint: blueprint.blueprintVersion,
	// 			core: PackageInfo.version,
	// 		},

	// 		// omit the below fields
	// 		previousPartId: null,
	// 		currentPartId: null,
	// 		nextPartId: null,
	// 		created: 0,
	// 		modified: 0,
	// 	}), ['previousPartId', 'currentPartId', 'nextPartId', 'created', 'modified'])
	// )
	// // Save rundown into database:
	// saveIntoDb(Rundowns, {
	// 	_id: dbROData._id
	// }, [dbROData], {
	// 	beforeInsert: (o) => {
	// 		o.created = getCurrentTime()
	// 		o.modified = getCurrentTime()
	// 		return o
	// 	},
	// 	beforeUpdate: (o) => {
	// 		o.modified = getCurrentTime()
	// 		return o
	// 	}
	// })

	// let dbRundown = Rundowns.findOne(dbROData._id)
	// if (!dbRundown) throw new Meteor.Error(500, 'Rundown not found (it should have been)')
	// // cache the Data
	// dbRundown.saveCache(CachePrefix.INGEST_RUNDOWN + dbRundown._id, rundown)

	// // Save the baseline
	// const blueprintRundownContext = new RundownContext(dbRundown, studio)
	// logger.info(`Building baseline items for ${dbRundown._id}...`)
	// logger.info(`... got ${rundownRes.baseline.length} items from baseline.`)

	// const baselineItem: RundownBaselineItem = {
	// 	_id: Random.id(7),
	// 	rundownId: dbRundown._id,
	// 	objects: postProcessPartBaselineItems(blueprintRundownContext, rundownRes.baseline)
	// }

	// saveIntoDb<RundownBaselineItem, RundownBaselineItem>(RundownBaselineItems, {
	// 	rundownId: dbRundown._id,
	// }, [baselineItem])

	// // Save the global adlibs
	// logger.info(`... got ${rundownRes.globalAdLibPieces.length} adLib items from baseline.`)
	// const adlibItems = postProcessAdLibPieces(blueprintRundownContext, rundownRes.globalAdLibPieces, 'baseline')
	// saveIntoDb<RundownBaselineAdLibItem, RundownBaselineAdLibItem>(RundownBaselineAdLibPieces, {
	// 	rundownId: dbRundown._id
	// }, adlibItems)

	// // Save Stories into database:

	// let existingParts = dbRundown.getParts()

	// // Note: a number of X stories will result in (<=X) Segments and X Parts
	// // let segments: DBSegment[] = []
	// let parts: DBPart[] = []
	// // let rankSegment = 0
	// let rankPart = 0
	// // let prevSlugParts: string[] = []
	// // let segment: DBSegment
	// _.each(rundown.Stories, (story: MOS.IMOSStory) => {
	// 	// divide into
	// 	// let slugParts = (story.Slug || '').toString().split(';')

	// 	// if (slugParts[0] !== prevSlugParts[0]) {
	// 		// segment = convertToSegment(story, rundownId(rundown.ID), rankSegment++)
	// 		// segments.push(segment)
	// 	// }
	// 	if (dbRundown) {
	// 		// join new data with old:
	// 		let part = convertToPart(story, dbRundown._id, rankPart++)
	// 		let existingPart = _.find(existingParts, (part) => {
	// 			return part._id === part._id
	// 		})
	// 		part = mergePart(part, existingPart)

	// 		parts.push(part)
	// 	} else throw new Meteor.Error(500, 'Rundown not found (it should have been)')

	// 	// prevSlugParts = slugParts
	// })
	// // logger.debug('parts', parts)
	// // logger.debug('---------------')
	// // logger.debug(Parts.find({rundownId: dbRundown._id}).fetch())
	// saveIntoDb<Part, DBPart>(Parts, {
	// 	rundownId: dbRundown._id
	// }, parts, {
	// 	beforeDiff (obj, oldObj) {
	// 		let o = _.extend({}, obj, {
	// 			segmentId: oldObj.segmentId
	// 		})
	// 		return o
	// 	},
	// 	afterInsert (part) {
	// 		// logger.debug('inserted part ' + part._id)
	// 		// @todo: have something here?
	// 		// let story: MOS.IMOSROStory | undefined = _.find(rundown.Stories, (s) => { return s.ID.toString() === segment.mosId } )
	// 		// if (story) {
	// 			// afterInsertUpdateSegment (story, rundownId(rundown.ID))
	// 		// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
	// 	},
	// 	afterUpdate (part) {
	// 		// logger.debug('updated part ' + part._id)
	// 		// @todo: have something here?
	// 		// let story: MOS.IMOSROStory | undefined = _.find(rundown.Stories, (s) => { return s.ID.toString() === segment.mosId } )
	// 		// if (story) {
	// 		// 	afterInsertUpdateSegment (story, rundownId(rundown.ID))
	// 		// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
	// 	},
	// 	afterRemove (part) {
	// 		afterRemovePart(part)
	// 	}
	// })
	// updateSegments(getMosRundownId(studio, rundown.ID))
}
function isAvailableForMOS (rundown: Rundown | undefined): boolean {
	if (rundown && rundown.unsynced) {
		logger.info(`Rundown "${rundown._id}" has been unsynced and needs to be synced before it can be updated.`)
		return false
	}
	return true
}
export namespace MosIntegration {
	export function mosRoCreate (id: string, token: string, rundown: MOS.IMOSRunningOrder) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		// logger.debug('mosRoCreate', rundown)
		logger.info('mosRoCreate ' + rundown.ID)
		logger.debug(rundown)

		handleRundownData(rundown, peripheralDevice, true)
	}
	export function mosRoReplace (id: string, token: string, rundown: MOS.IMOSRunningOrder) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoReplace ' + rundown.ID)
		// @ts-ignore
		logger.debug(rundown)
		handleRundownData(rundown, peripheralDevice, true)
	}
	export function mosRoDelete (id: string, token: string, rundownIdStr: string, force?: boolean) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoDelete ' + rundownIdStr)

		const studio = getStudio(peripheralDevice)

		const rundownId = new MOS.MosString128(rundownIdStr)
		let rundown = getRO(studio, rundownId)
		if (!isAvailableForMOS(rundown)) return
		updateDeviceLastDataReceived(peripheralDevice._id)
		logger.info('Removing rundown ' + getMosRundownId(studio, rundownId))

		if (rundown) {
			if (!rundown.active || force === true) {
				ServerRundownAPI.removeRundown(rundown._id)
			} else {
				if (!rundown.unsynced) {
					ServerRundownAPI.unsyncRundown(rundown._id)
				}
			}

		}
	}
	export function mosRoMetadata (id: string, token: string, rundownData: MOS.IMOSRunningOrderBase) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoMetadata ' + rundownData.ID)

		const studio = getStudio(peripheralDevice)

		// @ts-ignore
		logger.debug(rundownData)
		let rundown = getRO(studio, rundownData.ID)
		if (!isAvailableForMOS(rundown)) return
		updateDeviceLastDataReceived(peripheralDevice._id)

		let m: Partial<DBRundown> = {}
		if (rundownData.MosExternalMetaData) m.metaData = rundownData.MosExternalMetaData
		if (rundownData.Slug) 				m.name = rundownData.Slug.toString()
		if (rundownData.EditorialStart) 		m.expectedStart = formatTime(rundownData.EditorialStart)
		if (rundownData.EditorialDuration) 	m.expectedDuration = formatDuration(rundownData.EditorialDuration)

		if (!_.isEmpty(m)) {
			Rundowns.update(rundown._id, {$set: m})
			// update data cache:
			const cache = rundown.fetchCache(CachePrefix.INGEST_RUNDOWN + rundownId(rundownData.ID),)
			if (cache) {
				if (!cache.MosExternalMetaData) {
					cache.MosExternalMetaData = []
				}
				_.each(rundownData.MosExternalMetaData || [], (md, key) => {
					if (!cache.MosExternalMetaData[key]) {
						cache.MosExternalMetaData[key] = md
					}
					let md0 = cache.MosExternalMetaData[key]

					md0.MosPayload = _.extend(
						md0.MosPayload || {},
						md.MosPayload
					)
				})
			}

			rundown.saveCache(CachePrefix.INGEST_RUNDOWN + rundownId(rundownData.ID), cache)
		}
	}
	export function mosRoStatus (id: string, token: string, status: MOS.IMOSRunningOrderStatus) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStatus ' + status.ID)

		const studio = getStudio(peripheralDevice)

		let rundown = getRO(studio, status.ID)
		if (!isAvailableForMOS(rundown)) return
		updateDeviceLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(status)
		Rundowns.update(rundown._id, {$set: {
			status: status.Status
		}})
	}
	export function mosRoStoryStatus (id: string, token: string, status: MOS.IMOSStoryStatus) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryStatus ' + status.ID)

		const studio = getStudio(peripheralDevice)

		let rundown = getRO(studio, status.RunningOrderId)
		if (!isAvailableForMOS(rundown)) return
		updateDeviceLastDataReceived(peripheralDevice._id)

		// @ts-ignore
		logger.debug(status)
		// Save Stories (aka Part ) status into database:
		let part = Parts.findOne({
			_id: 			getMosPartId(getMosRundownId(studio, status.RunningOrderId), status.ID),
			rundownId: rundown._id
		})
		if (part) {
			Parts.update(part._id, {$set: {
				status: status.Status
			}})
		} else throw new Meteor.Error(404, 'Segment ' + status.ID + ' in rundown ' + status.RunningOrderId + ' not found')
	}
	export function mosRoStoryInsert (id: string, token: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryInsert after ' + Action.StoryID)

		const studio = getStudio(peripheralDevice)

		let rundown = getRO(studio, Action.RunningOrderID)
		if (!isAvailableForMOS(rundown)) return
		updateDeviceLastDataReceived(peripheralDevice._id)

		// @ts-ignore		logger.debug(
		logger.debug(Action, Stories)
		// insert a story (aka Part) before another story:
		let partAfter = (Action.StoryID ? getPart(studio, Action.RundownID, Action.StoryID) : null)

		// let newRankMax
		// let newRankMin
		let partBeforeOrLast: DBPart | undefined = (
			partAfter ?
				fetchBefore(Parts,
					{ rundownId: rundown._id },
					partAfter._rank
				) :
				fetchBefore(Parts,
					{ rundownId: rundown._id },
					null
				)
		)
		let affectedPartIds: Array<string> = []
		let firstInsertedPart: DBPart | undefined
		_.each(Stories, (story: MOS.IMOSROStory, i: number) => {
			logger.info('insert story ' + story.ID)
			let rank = getRank(partBeforeOrLast, partAfter, i, Stories.length)
			// let rank = newRankMin + ( i / Stories.length ) * (newRankMax - newRankMin)
			let part = upsertPart(story, rundown._id, rank)
			affectedPartIds.push(part._id)
			if (!firstInsertedPart) firstInsertedPart = part
		})

		if (partAfter && rundown.nextPartId === partAfter._id && firstInsertedPart && !rundown.nextPartManual) {
			// Move up next-point to the first inserted part
			ServerPlayoutAPI.rundownSetNext(rundown._id, firstInsertedPart._id)
		}

		updateSegments(rundown._id)
		updateAffectedParts(rundown, affectedPartIds)
	}
	export function mosRoStoryReplace (id: string, token: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryReplace ' + Action.StoryID)

		const studio = getStudio(peripheralDevice)

		let rundown = getRO(studio, Action.RunningOrderID)
		if (!isAvailableForMOS(rundown)) return
		updateDeviceLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(Action, Stories)
		// Replace a Story (aka a Part) with one or more Stories
		let partToReplace = getPart(studio, Action.RunningOrderID, Action.StoryID)

		let partBefore = fetchBefore(Parts, { rundownId: rundown._id }, partToReplace._rank)
		let partAfter = fetchAfter(Parts, { rundownId: rundown._id }, partToReplace._rank)

		let affectedPartIds: Array<string> = []

		let insertedPartIds: {[id: string]: boolean} = {}
		let firstInsertedPart: DBPart | undefined
		_.each(Stories, (story: MOS.IMOSROStory, i: number) => {
			logger.info('insert story ' + story.ID)
			let rank = getRank(partBefore, partAfter, i, Stories.length)
			let part = upsertPart(story, rundown._id, rank)
			insertedPartIds[part._id] = true
			affectedPartIds.push(part._id)
			if (!firstInsertedPart) firstInsertedPart = part

		})

		updateSegments(rundown._id)

		if (!insertedPartIds[partToReplace._id]) {
			// ok, the part to replace wasn't in the inserted parts
			// remove it then:
			affectedPartIds.push(partToReplace._id)
			removePart(rundown._id, partToReplace, firstInsertedPart)
		}

		updateAffectedParts(rundown, affectedPartIds)
	}
	export function mosRoStoryMove (id: string, token: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.MosString128>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn ('mosRoStoryMove ' + Action.StoryID)

		const studio = getStudio(peripheralDevice)

		let rundown = getRO(studio, Action.RunningOrderID)
		if (!isAvailableForMOS(rundown)) return
		updateDeviceLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(Action, Stories)

		// Move Stories (aka Part ## TODO ##Lines) to before a story

		let currentPart: Part | undefined = undefined
		let onAirNextWindowWidth: number | undefined = undefined
		let nextPosition: number | undefined = undefined
		if (rundown.currentPartId) {
			let nextPart: Part | undefined = undefined
			currentPart = Parts.findOne(rundown.currentPartId)
			if (rundown.nextPartId) nextPart = Parts.findOne(rundown.nextPartId)
			if (currentPart) {
				const parts = rundown.getParts({
					_rank: _.extend({
						$gte: currentPart._rank
					}, nextPart ? {
						$lte: nextPart._rank
					} : {})
				})
				onAirNextWindowWidth = parts.length
			}
		} else if (rundown.nextPartId) {
			let nextPart: Part | undefined = undefined
			nextPart = Parts.findOne(rundown.nextPartId)
			if (nextPart) {
				const parts = rundown.getParts({
					_rank: {
						$lte: nextPart._rank
					}
				})
				nextPosition = parts.length
			}
		}

		let partAfter = (Action.StoryID ? getPart(studio, Action.RunningOrderID, Action.StoryID) : null)
		let partBefore = fetchBefore(Parts, { rundownId: rundown._id }, (partAfter ? partAfter._rank : null))

		// console.log('Inserting between: ' + (partBefore ? partBefore._rank : 'X') + ' - ' + partAfter._rank)

		let affectedPartIds: Array<string> = []
		if (partAfter) affectedPartIds.push(partAfter._id)
		if (partBefore) affectedPartIds.push(partBefore._id)
		_.each(Stories, (storyId: MOS.MosString128, i: number) => {
			let rank = getRank(partBefore, partAfter, i, Stories.length)
			Parts.update(getMosPartId(rundown._id, storyId), {$set: {
				_rank: rank
			}})
		})

		updateSegments(rundown._id)
		updateAffectedParts(rundown, affectedPartIds)

		// Meteor.call('playout_storiesMoved', rundown._id, onAirNextWindowWidth, nextPosition)
		ServerPlayoutAPI.rundownStoriesMoved(rundown._id, onAirNextWindowWidth, nextPosition)
	}
	export function mosRoStoryDelete (id: string, token: string, Action: MOS.IMOSROAction, Stories: Array<MOS.MosString128>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStoryDelete ' + Action.RunningOrderID)

		const studio = getStudio(peripheralDevice)

		let rundown = getRO(studio, Action.RunningOrderID)
		if (!isAvailableForMOS(rundown)) return
		updateDeviceLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(Action, Stories)
		// Delete Stories (aka Part)
		let affectedPartIds: Array<string> = []
		_.each(Stories, (storyId: MOS.MosString128, i: number) => {
			logger.debug('remove story ' + storyId)
			let partId = getMosPartId(rundown._id, storyId)
			affectedPartIds.push(partId)
			removePart(rundown._id, partId)
		})
		updateSegments(rundown._id)
		updateAffectedParts(rundown, affectedPartIds)
	}
	export function mosRoStorySwap (id: string, token: string, Action: MOS.IMOSROAction, StoryID0: MOS.MosString128, StoryID1: MOS.MosString128) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoStorySwap ' + StoryID0 + ', ' + StoryID1)

		const studio = getStudio(peripheralDevice)

		let rundown = getRO(studio, Action.RunningOrderID)
		if (!isAvailableForMOS(rundown)) return
		updateDeviceLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(Action, StoryID0, StoryID1)
		// Swap Stories (aka Part)

		let part0 = getPart(studio, Action.RunningOrderID, StoryID0)
		let part1 = getPart(studio, Action.RunningOrderID, StoryID1)

		Parts.update(part0._id, {$set: {_rank: part1._rank}})
		Parts.update(part1._id, {$set: {_rank: part0._rank}})

		if (rundown.nextPartId === part0._id) {
			// Change nexted part
			ServerPlayoutAPI.rundownSetNext(rundown._id, part1._id)
		} else if (rundown.nextPartId === part1._id) {
			// Change nexted part
			ServerPlayoutAPI.rundownSetNext(rundown._id, part0._id)
		}

		updateSegments(rundown._id)
		updateAffectedParts(rundown, [part0._id, part1._id])
	}
	export function mosRoReadyToAir (id: string, token: string, Action: MOS.IMOSROReadyToAir) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoReadyToAir ' + Action.ID)

		const studio = getStudio(peripheralDevice)

		let rundown = getRO(studio, Action.ID)
		if (!isAvailableForMOS(rundown)) return
		updateDeviceLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(Action)
		// Set the ready to air status of a Rundown

		Rundowns.update(rundown._id, {$set: {
			airStatus: Action.Status
		}})

	}
	export function mosRoFullStory (id: string, token: string, story: MOS.IMOSROFullStory ) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRoFullStory ' + story.ID)

		const studio = getStudio(peripheralDevice)

		let rundown = getRO(studio, story.RundownId)
		if (!isAvailableForMOS(rundown)) return
		updateDeviceLastDataReceived(peripheralDevice._id)

		fixIllegalObject(story)
		// @ts-ignore
		// logger.debug(story)
		// Update db with the full story:
		// let segment = getSegment(story.RundownId, story.ID)
		let part = getPart(story.RundownId, story.ID)

		// cache the Data
		rundown.saveCache(CachePrefix.INGEST_PART + part._id, story)
		const changed = updateStory(rundown, part, story)

		const segment = part.getSegment()
		if (segment) {
			// this could be run after the segment, if we were capable of limiting that
			runPostProcessBlueprint(rundown, segment)
		}

		if (changed) {
			updateTimelineFromMosData(part.rundownId, [ part._id ])
		}
	}
	export function mosRoItemDelete (id: string, token: string, Action: MOS.IMOSStoryAction, Items: Array<MOS.MosString128>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemDelete NOT IMPLEMENTED YET ' + Action.StoryID)
		// @ts-ignore
		logger.debug(Action, Items)
	}
	export function mosRoItemStatus (id: string, token: string, status: MOS.IMOSItemStatus) {
		PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemStatus NOT IMPLEMENTED YET ' + status.ID)
		// @ts-ignore
		logger.debug(status)
	}
	export function mosRoItemInsert (id: string, token: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) {
		PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemInsert NOT SUPPORTED after ' + Action.ItemID)
		// @ts-ignore
		logger.debug(Action, Items)
	}
	export function mosRoItemReplace (id: string, token: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) {
		PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemReplace NOT IMPLEMENTED YET ' + Action.ItemID)
		// @ts-ignore
		logger.debug(Action, Items)
	}
	export function mosRoItemMove (id: string, token: string, Action: MOS.IMOSItemAction, Items: Array<MOS.MosString128>) {
		PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemMove NOT IMPLEMENTED YET ' + Action.ItemID)
		// @ts-ignore
		logger.debug(Action, Items)
	}
	export function mosRoItemSwap (id: string, token: string, Action: MOS.IMOSStoryAction, ItemID0: MOS.MosString128, ItemID1: MOS.MosString128) {
		PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRoItemSwap NOT IMPLEMENTED YET ' + ItemID0 + ', ' + ItemID1)
		// @ts-ignore
		logger.debug(Action, ItemID0, ItemID1)
	}
}

let methods: Methods = {}
methods[PeripheralDeviceAPI.methods.mosRoCreate] = (deviceId: string, deviceToken: string, rundown: MOS.IMOSRunningOrder) => {
	return MosIntegration.mosRoCreate(deviceId, deviceToken, rundown)
}
methods[PeripheralDeviceAPI.methods.mosRoReplace] = (deviceId: string, deviceToken: string, rundown: MOS.IMOSRunningOrder) => {
	return MosIntegration.mosRoReplace(deviceId, deviceToken, rundown)
}
methods[PeripheralDeviceAPI.methods.mosRoDelete] = (deviceId: string, deviceToken: string, rundownId: MOS.MosString128, force?: boolean) => {
	return MosIntegration.mosRoDelete(deviceId, deviceToken, rundownId, force)
}
methods[PeripheralDeviceAPI.methods.mosRoMetadata] = (deviceId: string, deviceToken: string, metadata: MOS.IMOSRunningOrderBase) => {
	return MosIntegration.mosRoMetadata(deviceId, deviceToken, metadata)
}
methods[PeripheralDeviceAPI.methods.mosRoStatus] = (deviceId: string, deviceToken: string, status: MOS.IMOSRunningOrderStatus) => {
	return MosIntegration.mosRoStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryStatus] = (deviceId: string, deviceToken: string, status: MOS.IMOSStoryStatus) => {
	return MosIntegration.mosRoStoryStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRoItemStatus] = (deviceId: string, deviceToken: string, status: MOS.IMOSItemStatus) => {
	return MosIntegration.mosRoItemStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryInsert] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) => {
	return MosIntegration.mosRoStoryInsert(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemInsert] = (deviceId: string, deviceToken: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) => {
	return MosIntegration.mosRoItemInsert(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryReplace] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) => {
	return MosIntegration.mosRoStoryReplace(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemReplace] = (deviceId: string, deviceToken: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) => {
	return MosIntegration.mosRoItemReplace(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryMove] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.MosString128>) => {
	return MosIntegration.mosRoStoryMove(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemMove] = (deviceId: string, deviceToken: string, Action: MOS.IMOSItemAction, Items: Array<MOS.MosString128>) => {
	return MosIntegration.mosRoItemMove(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStoryDelete] = (deviceId: string, deviceToken: string, Action: MOS.IMOSROAction, Stories: Array<MOS.MosString128>) => {
	return MosIntegration.mosRoStoryDelete(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRoItemDelete] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, Items: Array<MOS.MosString128>) => {
	return MosIntegration.mosRoItemDelete(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRoStorySwap] = (deviceId: string, deviceToken: string, Action: MOS.IMOSROAction, StoryID0: MOS.MosString128, StoryID1: MOS.MosString128) => {
	return MosIntegration.mosRoStorySwap(deviceId, deviceToken, Action, StoryID0, StoryID1)
}
methods[PeripheralDeviceAPI.methods.mosRoItemSwap] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, ItemID0: MOS.MosString128, ItemID1: MOS.MosString128) => {
	return MosIntegration.mosRoItemSwap(deviceId, deviceToken, Action, ItemID0, ItemID1)
}
methods[PeripheralDeviceAPI.methods.mosRoReadyToAir] = (deviceId: string, deviceToken: string, Action: MOS.IMOSROReadyToAir) => {
	return MosIntegration.mosRoReadyToAir(deviceId, deviceToken, Action)
}
methods[PeripheralDeviceAPI.methods.mosRoFullStory] = (deviceId: string, deviceToken: string, story: MOS.IMOSROFullStory) => {
	return MosIntegration.mosRoFullStory(deviceId, deviceToken, story)
}
// Apply methods:
setMeteorMethods(methods)

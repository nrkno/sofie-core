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
	SegmentLine,
	SegmentLines,
	DBSegmentLine
} from '../../../lib/collections/SegmentLines'
import {
	SegmentLineItem,
	SegmentLineItems
} from '../../../lib/collections/SegmentLineItems'
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
	StudioInstallations,
	StudioInstallation
} from '../../../lib/collections/StudioInstallations'
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
import { CachePrefix, RundownDataCacheObj } from '../../../lib/collections/RundownDataCache'
import {
	setMeteorMethods,
	Methods
} from '../../methods'
import {
	afterRemoveSegmentLine,
	updateSegments,
	updateAffectedSegmentLines,
	removeSegmentLine,
	runPostProcessBlueprint,
	ServerRundownAPI,
	selectShowStyleVariant
} from '../rundown'
import { syncFunction } from '../../codeControl'
import { IBlueprintSegmentLine, SegmentLineHoldMode, IngestRundown } from 'tv-automation-sofie-blueprints-integration'
import { updateExpectedMediaItems } from '../expectedMediaItems'
import { Blueprint, Blueprints } from '../../../lib/collections/Blueprints'
import { SegmentLineNote, NoteType } from '../../../lib/api/notes'
import { loadShowStyleBlueprints } from '../blueprints/cache'
import { postProcessAdLibPieces, postProcessSegmentLineItems, postProcessSegmentLineBaselineItems } from '../blueprints/postProcess'
import { ShowStyleContext, RundownContext } from '../blueprints/context'
import { RundownBaselineItem, RundownBaselineItems } from '../../../lib/collections/RundownBaselineItems'
import { Random } from 'meteor/random'
import { RundownBaselineAdLibItem, RundownBaselineAdLibItems } from '../../../lib/collections/RundownBaselineAdLibItems'
const PackageInfo = require('../../../package.json')

export function rundownId (rundownId: MOS.MosString128, original?: boolean): string {
	// logger.debug('rundownId', rundownId)
	if (!rundownId) throw new Meteor.Error(401, 'parameter rundownId missing!')
	let id = 'rundown_' + (rundownId['_str'] || rundownId.toString())
	return (original ? id : getHash(id))
}
export function segmentLineId (rundownId: string, storyId: MOS.MosString128): string {
	let id = rundownId + '_' + storyId.toString()
	return getHash(id)
}
/**
 * Returns a Rundown, throws error if not found
 * @param rundownId Id of the Rundown
 */
export function getRO (rundownID: MOS.MosString128): Rundown {
	let id = rundownId(rundownID)
	let rundown = Rundowns.findOne(id)
	if (rundown) {
		rundown.touch()
		return rundown
	} else throw new Meteor.Error(404, 'Rundown ' + id + ' not found (rundown: ' + rundownID + ')')
}
/**
 * Returns a Segment (aka a Story), throws error if not found
 * @param rundownId Rundown id
 * @param segmentId Segment / Story id
 */
// export function getSegment (rundownID: MOS.MosString128, storyID: MOS.MosString128, rank: number): Segment {
// 	let id = segmentId(rundownId(rundownID), storyID, rank)
// 	let segments = Segments.findOne({
// 		rundownId: rundownId(rundownID),
// 		_id: id
// 	})
// 	if (segments) {
// 		return segments
// 	} else throw new Meteor.Error(404, 'Segment ' + id + ' not found')
// }
/**
 * Returns a SegmentLine (aka an Item), throws error if not found
 * @param rundownId
 * @param segmentLineId
 */
export function getSegmentLine (rundownID: MOS.MosString128, storyID: MOS.MosString128): SegmentLine {
	let id = segmentLineId(rundownId(rundownID), storyID)
	let segmentLine = SegmentLines.findOne({
		rundownId: rundownId( rundownID ),
		_id: id
	})
	if (segmentLine) {
		return segmentLine
	} else {
		let rundown = getRO(rundownID)
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
		throw new Meteor.Error(404, 'SegmentLine ' + id + ' not found (rundown: ' + rundownID + ', story: ' + storyID + ')')
	}
}

/**
 * Converts an Item into a SegmentLine
 * @param item MOS Item
 * @param rundownId Rundown id of the item
 * @param segmentId Segment / Story id of the item
 * @param rank Rank of the story
 */
export function convertToSegmentLine (story: MOS.IMOSStory, rundownId: string, rank: number): DBSegmentLine {
	return {
		_id: segmentLineId(rundownId, story.ID),
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
 * Merge an old segmentLine with a new one (to be used together with (after) convertToSegmentLine )
 * @param newSegmentLine
 * @param existingSegmentLine
 */
export function mergeSegmentLine (newSegmentLine: DBSegmentLine, existingSegmentLine?: DBSegmentLine): DBSegmentLine {
	if (existingSegmentLine) {
		if (existingSegmentLine._id !== newSegmentLine._id) {
			throw new Meteor.Error(500, `mergeSegmentLine: ids differ: ${newSegmentLine._id}, ${existingSegmentLine._id}`)
		}

		newSegmentLine = _.extend({}, existingSegmentLine, _.omit(newSegmentLine, ['segmentId']))

		newSegmentLine.typeVariant = existingSegmentLine.typeVariant || newSegmentLine.typeVariant // typeVariant is set in the blueprints
		newSegmentLine.subTypeVariant = existingSegmentLine.subTypeVariant || newSegmentLine.subTypeVariant // subTypeVariant is set in the blueprints
	}
	return newSegmentLine
}
/**
 * Insert a new SegmentLine (aka an Item)
 * @param item The item to be inserted
 * @param rundownId The id of the Rundown
 * @param segmentId The id of the Segment / Story
 * @param rank The new rank of the SegmentLine
 */
export function upsertSegmentLine (story: MOS.IMOSStory, rundownId: string, rank: number): DBSegmentLine {
	let sl = convertToSegmentLine(story, rundownId, rank)
	SegmentLines.upsert(sl._id, {$set: sl}) // insert, or update
	afterInsertUpdateSegmentLine(story, rundownId)
	return sl
}
export function afterInsertUpdateSegmentLine (story: MOS.IMOSStory, rundownId: string) {
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
export const updateStory: (rundown: Rundown, segmentLine: SegmentLine, story: MOS.IMOSROFullStory) => boolean
= syncFunction(function updateStory (rundown: Rundown, segmentLine: SegmentLine, story: MOS.IMOSROFullStory): boolean {
	let showStyleBase = ShowStyleBases.findOne(rundown.showStyleBaseId)
	if (!showStyleBase) throw new Meteor.Error(404, 'ShowStyleBase "' + rundown.showStyleBaseId + '" not found!')

	const context = new SegmentLineContext(rundown, segmentLine, story)
	context.handleNotesExternally = true

	let resultSl: IBlueprintSegmentLine | undefined = undefined
	let resultSli: SegmentLineItem[] | undefined = undefined
	let resultAdlibSli: AdLibPiece[] | undefined = undefined
	let notes: SegmentLineNote[] = []
	try {
		const blueprints = loadShowStyleBlueprints(showStyleBase)
		let result = blueprints.getSegmentLine(context, story) // TODO: refactor this

 		if (result) {
			resultAdlibSli = postProcessAdLibPieces(context, result.adLibItems, result.segmentLine.typeVariant, segmentLine._id)
			resultSli = postProcessSegmentLineItems(context, result.segmentLineItems, result.segmentLine.typeVariant, segmentLine._id)
			resultSl = result.segmentLine
		}

 		notes = context.getNotes()
	} catch (e) {
		logger.error(e.stack ? e.stack : e.toString())
		// throw e
		notes = [{
			type: NoteType.ERROR,
			origin: {
				name: '',				rundownId: context.rundown._id,
				segmentId: (context.segmentLine as DBSegmentLine).segmentId,
				segmentLineId: context.segmentLine._id,
			},
			message: 'Internal Server Error'
		}],
		resultSli = undefined
		resultAdlibSli = undefined
	}

	let changedSli: {
		added: number,
		updated: number,
		removed: number
	} = {
		added: 0,
		updated: 0,
		removed: 0
	}
	if (resultSl) {
		SegmentLines.update(segmentLine._id, {$set: {
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
			holdMode: 				resultSl.holdMode || SegmentLineHoldMode.NONE,
			classes: 				resultSl.classes || [],
			classesForNext: 		resultSl.classesForNext || [],
			displayDurationGroup: 	resultSl.displayDurationGroup || '', // TODO - or unset?
			displayDuration: 		resultSl.displayDuration || 0, // TODO - or unset
			invalid: 				resultSl.invalid || false
		}})
	} else {
		SegmentLines.update(segmentLine._id, {$set: {
			notes: notes,
			invalid: true
		}})
	}

	if (resultSli) {
		changedSli = saveIntoDb<SegmentLineItem, SegmentLineItem>(SegmentLineItems, {
			rundownId: rundown._id,
			segmentLineId: segmentLine._id,
			dynamicallyInserted: { $ne: true } // do not affect dynamically inserted items (such as adLib items)
		}, resultSli || [], {
			afterInsert (segmentLineItem) {
				logger.debug('inserted segmentLineItem ' + segmentLineItem._id)
				logger.debug(segmentLineItem)
				// @todo: have something here?
				// let story: MOS.IMOSROStory | undefined = _.find(rundown.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
					// afterInsertUpdateSegment (story, rundownId(rundown.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterUpdate (segmentLineItem) {
				logger.debug('updated segmentLineItem ' + segmentLineItem._id)
				// @todo: have something here?
				// let story: MOS.IMOSROStory | undefined = _.find(rundown.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
				// 	afterInsertUpdateSegment (story, rundownId(rundown.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterRemove (segmentLineItem) {
				logger.debug('deleted segmentLineItem ' + segmentLineItem._id)
				// @todo: handle this:
				// afterRemoveSegmentLineItem(segmentLine._id)
			}
		})
	}
	if (resultAdlibSli) {
		saveIntoDb<AdLibPiece, AdLibPiece>(AdLibPieces, {
			rundownId: rundown._id,
			segmentLineId: segmentLine._id,
			// fromPostProcess: { $ne: true }, // do not affect postProcess items
		}, resultAdlibSli || [], {
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
				logger.debug('updated segmentLineItem ' + adLibPiece._id)
				// @todo: have something here?
				// let story: MOS.IMOSROStory | undefined = _.find(rundown.Stories, (s) => { return s.ID.toString() === segment.mosId } )
				// if (story) {
				// 	afterInsertUpdateSegment (story, rundownId(rundown.ID))
				// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
			},
			afterRemove (adLibPiece) {
				logger.debug('deleted segmentLineItem ' + adLibPiece._id)
				// @todo: handle this:
				// afterRemoveSegmentLineItem(segmentLine._id)
			}
		})
	}

	if (resultSli || resultAdlibSli) {
		try {
			updateExpectedMediaItems(rundown._id, segmentLine._id)
		} catch (e) {
			logger.error('Error updating expectedMediaItems: ' + e.toString())
		}
	}

	// if anything was changed
	return (changedSli.added > 0 || changedSli.removed > 0 || changedSli.updated > 0)
	// return this.core.mosManipulate(P.methods.mosRundownReadyToAir, story)
})

export function sendStoryStatus (rundown: Rundown, takeSegmentLine: SegmentLine | null) {

	if (rundown.currentPlayingStoryStatus) {
		setStoryStatus(rundown.peripheralDeviceId, rundown, rundown.currentPlayingStoryStatus, MOS.IMOSObjectStatus.STOP)
		.catch(e => logger.error(e))
	}
	if (takeSegmentLine) {
		setStoryStatus(rundown.peripheralDeviceId, rundown, takeSegmentLine.externalId, MOS.IMOSObjectStatus.PLAY)
		.catch(e => logger.error(e))

		Rundowns.update(this._id, {$set: {
			currentPlayingStoryStatus: takeSegmentLine.externalId
		}})
		rundown.currentPlayingStoryStatus = takeSegmentLine.externalId
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

		PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err: any, rundown: MOS.IMOSRundown) => {
			// console.log('Response!')
			if (err) {
				logger.error(err)
				cb(err)
			} else {
				try {
					logger.info('triggerGetRundown reply ' + rundown.ID)
					logger.debug(rundown)

					handleRundownData(rundown, peripheralDevice, 'rundownList')
					cb(null)
				} catch (e) {
					cb(e)
				}
			}
		}, 'triggerGetRundown', rundown.externalId)
	}
)
export function replaceStoryItem (rundown: Rundown, segmentLineItem: SegmentLineItem, slCache: RundownDataCacheObj, inPoint: number, duration: number) {
	return new Promise((resolve, reject) => {
		const story = slCache.data.Body.filter(item => item.Type === 'storyItem' && item.Content.ID === segmentLineItem.externalId)[0].Content
		story.EditorialStart = inPoint
		story.EditorialDuration = duration

		const peripheralDevice = PeripheralDevices.findOne(rundown.peripheralDeviceId)
		if (!peripheralDevice) throw new Meteor.Error(404, 'PeripheralDevice "' + rundown.peripheralDeviceId + '" not found' )

		PeripheralDeviceAPI.executeFunction(peripheralDevice._id, (err?: any) => {
			if (err) reject(err)
			else resolve()
		}, 'replaceStoryItem', slCache.data.RundownId, slCache.data.ID, story)
	})
}

function handleRundownData (rundown: MOS.IMOSRundown, peripheralDevice: PeripheralDevice, dataSource: string) {
	// Create or update a rundown (ie from rundownCreate or rundownList)

	let existingDbRundown = Rundowns.findOne(rundownId(rundown.ID))
	if (!isAvailableForMOS(existingDbRundown)) return
	updateMosLastDataReceived(peripheralDevice._id)
	logger.info((existingDbRundown ? 'Updating' : 'Adding') + ' rundown ' + rundownId(rundown.ID))

	let studioInstallationId = peripheralDevice.studioInstallationId
	if (!studioInstallationId && peripheralDevice.parentDeviceId) {
		// Also check the parent device:
		let parentDevice = PeripheralDevices.findOne(peripheralDevice.parentDeviceId)
		if (parentDevice) {
			studioInstallationId = parentDevice.studioInstallationId
		}
	}

	if (!studioInstallationId) throw new Meteor.Error(500, 'PeripheralDevice "' + peripheralDevice._id + '" has no StudioInstallation')

	let studioInstallation = StudioInstallations.findOne(studioInstallationId) as StudioInstallation
	if (!studioInstallation) throw new Meteor.Error(404, 'StudioInstallation "' + studioInstallationId + '" not found')

	const ingestRundown = literal<IngestRundown>({
		externalId: rundown.ID.toString(),
		name: rundown.Slug.toString(),
		type: 'mos',
		segments: [],
		payload: rundown
	})

	const showStyle = selectShowStyleVariant(studioInstallation, ingestRundown)
	if (!showStyle) {
		logger.warn('Studio blueprint rejected rundown')
		return
	}

	const showStyleBlueprint = loadShowStyleBlueprints(showStyle.base)
	const blueprintContext = new ShowStyleContext(studioInstallation, showStyle.base._id, showStyle.variant._id)
	const rundownRes = showStyleBlueprint.getRundown(blueprintContext, ingestRundown)

	let blueprint = Blueprints.findOne(showStyle.base.blueprintId) as Blueprint || {}

	let dbROData: DBRundown = _.extend(existingDbRundown || {},
		_.omit(literal<DBRundown>({
			_id: rundownId(rundown.ID),
			externalId: rundown.ID.toString(),
			studioInstallationId: studioInstallation._id,
			peripheralDeviceId: peripheralDevice._id,
			showStyleVariantId: showStyle.variant._id,
			showStyleBaseId: showStyle.base._id,
			name: rundown.Slug.toString(),
			expectedStart: formatTime(rundown.EditorialStart),
			expectedDuration: formatDuration(rundown.EditorialDuration),
			dataSource: dataSource,
			unsynced: false,

			importVersions: {
				studioInstallation: studioInstallation._rundownVersionHash,
				showStyleBase: showStyle.base._rundownVersionHash,
				showStyleVariant: showStyle.variant._rundownVersionHash,
				blueprint: blueprint.blueprintVersion,
				core: PackageInfo.version,
			},

			// omit the below fields
			previousSegmentLineId: null,
			currentSegmentLineId: null,
			nextSegmentLineId: null,
			created: 0,
			modified: 0,
		}), ['previousSegmentLineId', 'currentSegmentLineId', 'nextSegmentLineId', 'created', 'modified'])
	)
	// Save rundown into database:
	saveIntoDb(Rundowns, {
		_id: dbROData._id
	}, [dbROData], {
		beforeInsert: (o) => {
			o.created = getCurrentTime()
			o.modified = getCurrentTime()
			return o
		},
		beforeUpdate: (o) => {
			o.modified = getCurrentTime()
			return o
		}
	})

	let dbRundown = Rundowns.findOne(dbROData._id)
	if (!dbRundown) throw new Meteor.Error(500, 'Rundown not found (it should have been)')
	// cache the Data
	dbRundown.saveCache(CachePrefix.INGEST_RUNDOWN + dbRundown._id, rundown)

	// Save the baseline
	const blueprintRundownContext = new RundownContext(dbRundown, studioInstallation)
	logger.info(`Building baseline items for ${dbRundown._id}...`)
	logger.info(`... got ${rundownRes.baseline.length} items from baseline.`)

	const baselineItem: RundownBaselineItem = {
		_id: Random.id(7),
		rundownId: dbRundown._id,
		objects: postProcessSegmentLineBaselineItems(blueprintRundownContext, rundownRes.baseline)
	}

	saveIntoDb<RundownBaselineItem, RundownBaselineItem>(RundownBaselineItems, {
		rundownId: dbRundown._id,
	}, [baselineItem])

	// Save the global adlibs
	logger.info(`... got ${rundownRes.globalAdLibPieces.length} adLib items from baseline.`)
	const adlibItems = postProcessAdLibPieces(blueprintRundownContext, rundownRes.globalAdLibPieces, 'baseline')
	saveIntoDb<RundownBaselineAdLibItem, RundownBaselineAdLibItem>(RundownBaselineAdLibItems, {
		rundownId: dbRundown._id
	}, adlibItems)

	// Save Stories into database:

	let existingSegmentLines = dbRundown.getSegmentLines()

	// Note: a number of X stories will result in (<=X) Segments and X SegmentLines
	// let segments: DBSegment[] = []
	let segmentLines: DBSegmentLine[] = []
	// let rankSegment = 0
	let rankSegmentLine = 0
	// let prevSlugParts: string[] = []
	// let segment: DBSegment
	_.each(rundown.Stories, (story: MOS.IMOSStory) => {
		// divide into
		// let slugParts = (story.Slug || '').toString().split(';')

		// if (slugParts[0] !== prevSlugParts[0]) {
			// segment = convertToSegment(story, rundownId(rundown.ID), rankSegment++)
			// segments.push(segment)
		// }
		if (dbRundown) {
			// join new data with old:
			let segmentLine = convertToSegmentLine(story, dbRundown._id, rankSegmentLine++)
			let existingSegmentLine = _.find(existingSegmentLines, (sl) => {
				return sl._id === segmentLine._id
			})
			segmentLine = mergeSegmentLine(segmentLine, existingSegmentLine)

			segmentLines.push(segmentLine)
		} else throw new Meteor.Error(500, 'Rundown not found (it should have been)')

		// prevSlugParts = slugParts
	})
	// logger.debug('segmentLines', segmentLines)
	// logger.debug('---------------')
	// logger.debug(SegmentLines.find({rundownId: dbRundown._id}).fetch())
	saveIntoDb<SegmentLine, DBSegmentLine>(SegmentLines, {
		rundownId: dbRundown._id
	}, segmentLines, {
		beforeDiff (obj, oldObj) {
			let o = _.extend({}, obj, {
				segmentId: oldObj.segmentId
			})
			return o
		},
		afterInsert (segmentLine) {
			// logger.debug('inserted segmentLine ' + segmentLine._id)
			// @todo: have something here?
			// let story: MOS.IMOSROStory | undefined = _.find(rundown.Stories, (s) => { return s.ID.toString() === segment.mosId } )
			// if (story) {
				// afterInsertUpdateSegment (story, rundownId(rundown.ID))
			// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
		},
		afterUpdate (segmentLine) {
			// logger.debug('updated segmentLine ' + segmentLine._id)
			// @todo: have something here?
			// let story: MOS.IMOSROStory | undefined = _.find(rundown.Stories, (s) => { return s.ID.toString() === segment.mosId } )
			// if (story) {
			// 	afterInsertUpdateSegment (story, rundownId(rundown.ID))
			// } else throw new Meteor.Error(500, 'Story not found (it should have been)')
		},
		afterRemove (segmentLine) {
			afterRemoveSegmentLine(segmentLine)
		}
	})
	updateSegments(rundownId(rundown.ID))
}
function isAvailableForMOS (rundown: Rundown | undefined): boolean {
	if (rundown && rundown.unsynced) {
		logger.info(`Rundown "${rundown._id}" has been unsynced and needs to be synced before it can be updated.`)
		return false
	}
	return true
}
function updateMosLastDataReceived (deviceId: string) {
	PeripheralDevices.update(deviceId, {
		$set: {
			lastDataReceived: getCurrentTime()
		}
	})
}
export namespace MosIntegration {
	export function mosRundownCreate (id: string, token: string, rundown: MOS.IMOSRundown) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		// logger.debug('mosRundownCreate', rundown)
		logger.info('mosRundownCreate ' + rundown.ID)
		logger.debug(rundown)

		handleRundownData(rundown, peripheralDevice, 'rundownCreate')
	}
	export function mosRundownReplace (id: string, token: string, rundown: MOS.IMOSRundown) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRundownReplace ' + rundown.ID)
		// @ts-ignore
		logger.debug(rundown)
		handleRundownData(rundown, peripheralDevice, 'rundownReplace')
	}
	export function mosRundownDelete (id: string, token: string, rundownId: MOS.MosString128, force?: boolean) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRundownDelete ' + rundownId.toString())

		let rundown = getRO(rundownId)
		if (!isAvailableForMOS(rundown)) return
		updateMosLastDataReceived(peripheralDevice._id)
		logger.info('Removing rundown ' + rundownId(rundownId))

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
	export function mosRundownMetadata (id: string, token: string, rundownData: MOS.IMOSRundownBase) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRundownMetadata ' + rundownData.ID)

		// @ts-ignore
		logger.debug(rundownData)
		let rundown = getRO(rundownData.ID)
		if (!isAvailableForMOS(rundown)) return
		updateMosLastDataReceived(peripheralDevice._id)

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
	export function mosRundownStatus (id: string, token: string, status: MOS.IMOSRundownStatus) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRundownStatus ' + status.ID)

		let rundown = getRO(status.ID)
		if (!isAvailableForMOS(rundown)) return
		updateMosLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(status)
		Rundowns.update(rundown._id, {$set: {
			status: status.Status
		}})
	}
	export function mosRundownStoryStatus (id: string, token: string, status: MOS.IMOSStoryStatus) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRundownStoryStatus ' + status.ID)

		let rundown = getRO(status.RundownId)
		if (!isAvailableForMOS(rundown)) return
		updateMosLastDataReceived(peripheralDevice._id)

		// @ts-ignore
		logger.debug(status)
		// Save Stories (aka SegmentLine ) status into database:
		let segmentLine = SegmentLines.findOne({
			_id: 			segmentLineId(rundownId(status.RundownId), status.ID),
			rundownId: rundown._id
		})
		if (segmentLine) {
			SegmentLines.update(segmentLine._id, {$set: {
				status: status.Status
			}})
		} else throw new Meteor.Error(404, 'Segment ' + status.ID + ' in rundown ' + status.RundownId + ' not found')
	}
	export function mosRundownItemStatus (id: string, token: string, status: MOS.IMOSItemStatus) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRundownItemStatus NOT IMPLEMENTED YET ' + status.ID)
		// @ts-ignore
		logger.debug(status)
		/*
		// Save status of Item database:
		let segmentID = segmentId(rundownId(status.RundownId), status.StoryId)
		let segmentLine = SegmentLineIte.findOne({
			_id: 			segmentLineId(segmentID, status.ID),
			segmentId: 		segmentID,
			rundownId: rundownId(status.RundownId)
		})
		if (segmentLine) {
			SegmentLines.update(segmentLine._id, {$set: {
				status: status.Status
			}})
		} else throw new Meteor.Error(404, 'SegmentLine ' + status.ID + ' in segment ' + status.StoryId + ' in rundown ' + status.RundownId + ' not found')
		*/
	}
	export function mosRundownStoryInsert (id: string, token: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRundownStoryInsert after ' + Action.StoryID)

		let rundown = getRO(Action.RundownID)
		if (!isAvailableForMOS(rundown)) return
		updateMosLastDataReceived(peripheralDevice._id)

		// @ts-ignore		logger.debug(
		logger.debug(Action, Stories)
		// insert a story (aka SegmentLine) before another story:
		let segmentLineAfter = (Action.StoryID ? getSegmentLine(Action.RundownID, Action.StoryID) : null)

		// let newRankMax
		// let newRankMin
		let segmentLineBeforeOrLast: DBSegmentLine | undefined = (
			segmentLineAfter ?
				fetchBefore(SegmentLines,
					{ rundownId: rundown._id },
					segmentLineAfter._rank
				) :
				fetchBefore(SegmentLines,
					{ rundownId: rundown._id },
					null
				)
		)
		let affectedSegmentLineIds: Array<string> = []
		let firstInsertedSegmentLine: DBSegmentLine | undefined
		_.each(Stories, (story: MOS.IMOSROStory, i: number) => {
			logger.info('insert story ' + story.ID)
			let rank = getRank(segmentLineBeforeOrLast, segmentLineAfter, i, Stories.length)
			// let rank = newRankMin + ( i / Stories.length ) * (newRankMax - newRankMin)
			let segmentLine = upsertSegmentLine(story, rundown._id, rank)
			affectedSegmentLineIds.push(segmentLine._id)
			if (!firstInsertedSegmentLine) firstInsertedSegmentLine = segmentLine
		})

		if (segmentLineAfter && rundown.nextSegmentLineId === segmentLineAfter._id && firstInsertedSegmentLine && !rundown.nextSegmentLineManual) {
			// Move up next-point to the first inserted segmentLine
			ServerPlayoutAPI.rundownSetNext(rundown._id, firstInsertedSegmentLine._id)
		}

		updateSegments(rundown._id)
		updateAffectedSegmentLines(rundown, affectedSegmentLineIds)
	}
	export function mosRundownItemInsert (id: string, token: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRundownItemInsert NOT SUPPORTED after ' + Action.ItemID)
		// @ts-ignore
		logger.debug(Action, Items)
		/*
		// insert an item (aka SegmentLine ## TODO ##Line) before another story:
		let rundown = getRO(Action.RundownID)
		let segment = getSegment(Action.RundownID, Action.StoryID)
		let segmentLineAfter = (Action.ItemID ? getSegmentLine(Action.RundownID, Action.StoryID, Action.ItemID) : null)

		let segmentLineBeforeOrLast
		let newRankMax
		let newRankMin
		if (segmentLineAfter) {
			segmentLineBeforeOrLast = fetchBefore(SegmentLines,
				{ rundownId: rundown._id, segmentId: segment._id },
				segmentLineAfter._rank
			)
		} else {
			segmentLineBeforeOrLast = fetchBefore(SegmentLines,
				{ rundownId: rundown._id, segmentId: segment._id },
				null
			)
		}
		_.each(Items, (item: MOS.IMOSItem, i: number) => {
			let rank = getRank(segmentLineBeforeOrLast, segmentLineAfter, i, Items.length)
			// let rank = newRankMin + ( i / Items.length ) * (newRankMax - newRankMin)
			insertSegmentLine(item, rundown._id, segment._id, rank)
		})
		*/
	}
	export function mosRundownStoryReplace (id: string, token: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRundownStoryReplace ' + Action.StoryID)

		let rundown = getRO(Action.RundownID)
		if (!isAvailableForMOS(rundown)) return
		updateMosLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(Action, Stories)
		// Replace a Story (aka a SegmentLine) with one or more Stories
		let segmentLineToReplace = getSegmentLine(Action.RundownID, Action.StoryID)

		let segmentLineBefore = fetchBefore(SegmentLines, { rundownId: rundown._id }, segmentLineToReplace._rank)
		let segmentLineAfter = fetchAfter(SegmentLines, { rundownId: rundown._id }, segmentLineToReplace._rank)

		let affectedSegmentLineIds: Array<string> = []

		let insertedSegmentLineIds: {[id: string]: boolean} = {}
		let firstInsertedSegmentLine: DBSegmentLine | undefined
		_.each(Stories, (story: MOS.IMOSROStory, i: number) => {
			logger.info('insert story ' + story.ID)
			let rank = getRank(segmentLineBefore, segmentLineAfter, i, Stories.length)
			let sl = upsertSegmentLine(story, rundown._id, rank)
			insertedSegmentLineIds[sl._id] = true
			affectedSegmentLineIds.push(sl._id)
			if (!firstInsertedSegmentLine) firstInsertedSegmentLine = sl
		})

		updateSegments(rundown._id)

		if (!insertedSegmentLineIds[segmentLineToReplace._id]) {
			// ok, the segmentline to replace wasn't in the inserted segment lines
			// remove it then:
			affectedSegmentLineIds.push(segmentLineToReplace._id)
			removeSegmentLine(rundown._id, segmentLineToReplace, firstInsertedSegmentLine)
		}

		updateAffectedSegmentLines(rundown, affectedSegmentLineIds)
	}
	export function mosRundownItemReplace (id: string, token: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRundownItemReplace NOT IMPLEMENTED YET ' + Action.ItemID)
		// @ts-ignore
		logger.debug(Action, Items)
		/*
		// Replace an item (aka SegmentLine ## TODO ##Line) with one or more items
		let rundown = getRO(Action.RundownID)
		let segmentLineToReplace = getSegmentLine(Action.RundownID, Action.StoryID, Action.ItemID)

		let segmentLineBefore = fetchBefore(SegmentLines, { rundownId: rundown._id, segmentId: segmentLineToReplace.segmentId }, segmentLineToReplace._rank)
		let segmentLineAfter = fetchAfter(SegmentLines, { rundownId: rundown._id, segmentId: segmentLineToReplace.segmentId }, segmentLineToReplace._rank)

		removeSegmentLine(segmentLineToReplace._id)

		_.each(Items, (item: MOS.IMOSItem, i: number) => {
			let rank = getRank (segmentLineBefore, segmentLineAfter, i, Items.length)
			insertSegmentLine(item, rundown._id, rank)
		})
		*/
	}
	export function mosRundownStoryMove (id: string, token: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.MosString128>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn ('mosRundownStoryMove ' + Action.StoryID)

		let rundown = getRO(Action.RundownID)
		if (!isAvailableForMOS(rundown)) return
		updateMosLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(Action, Stories)

		// Move Stories (aka SegmentLine ## TODO ##Lines) to before a story

		let currentSegmentLine: SegmentLine | undefined = undefined
		let onAirNextWindowWidth: number | undefined = undefined
		let nextPosition: number | undefined = undefined
		if (rundown.currentSegmentLineId) {
			let nextSegmentLine: SegmentLine | undefined = undefined
			currentSegmentLine = SegmentLines.findOne(rundown.currentSegmentLineId)
			if (rundown.nextSegmentLineId) nextSegmentLine = SegmentLines.findOne(rundown.nextSegmentLineId)
			if (currentSegmentLine) {
				const segmentLines = rundown.getSegmentLines({
					_rank: _.extend({
						$gte: currentSegmentLine._rank
					}, nextSegmentLine ? {
						$lte: nextSegmentLine._rank
					} : {})
				})
				onAirNextWindowWidth = segmentLines.length
			}
		} else if (rundown.nextSegmentLineId) {
			let nextSegmentLine: SegmentLine | undefined = undefined
			nextSegmentLine = SegmentLines.findOne(rundown.nextSegmentLineId)
			if (nextSegmentLine) {
				const segmentLines = rundown.getSegmentLines({
					_rank: {
						$lte: nextSegmentLine._rank
					}
				})
				nextPosition = segmentLines.length
			}
		}

		let segmentLineAfter = (Action.StoryID ? getSegmentLine(Action.RundownID, Action.StoryID) : null)
		let segmentLineBefore = fetchBefore(SegmentLines, { rundownId: rundown._id }, (segmentLineAfter ? segmentLineAfter._rank : null))

		// console.log('Inserting between: ' + (segmentLineBefore ? segmentLineBefore._rank : 'X') + ' - ' + segmentLineAfter._rank)

		let affectedSegmentLineIds: Array<string> = []
		if (segmentLineAfter) affectedSegmentLineIds.push(segmentLineAfter._id)
		if (segmentLineBefore) affectedSegmentLineIds.push(segmentLineBefore._id)
		_.each(Stories, (storyId: MOS.MosString128, i: number) => {
			let rank = getRank(segmentLineBefore, segmentLineAfter, i, Stories.length)
			SegmentLines.update(segmentLineId(rundown._id, storyId), {$set: {
				_rank: rank
			}})
		})

		updateSegments(rundown._id)
		updateAffectedSegmentLines(rundown, affectedSegmentLineIds)

		// Meteor.call('playout_storiesMoved', rundown._id, onAirNextWindowWidth, nextPosition)
		ServerPlayoutAPI.rundownStoriesMoved(rundown._id, onAirNextWindowWidth, nextPosition)
	}
	export function mosRundownItemMove (id: string, token: string, Action: MOS.IMOSItemAction, Items: Array<MOS.MosString128>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRundownItemMove NOT IMPLEMENTED YET ' + Action.ItemID)
		// @ts-ignore
		logger.debug(Action, Items)
		/*
		// Move Items (#####) to before a story
		let rundown = getRO(Action.RundownID)
		let segmentLineAfter = getSegmentLine(Action.RundownID, Action.StoryID, Action.ItemID)
		let segmentLineBefore = fetchBefore(SegmentLines,
			{ rundownId: rundown._id, segmentId: segmentLineAfter.segmentId},
			segmentLineAfter._rank)

		_.each(Items, (itemId: MOS.MosString128, i: number) => {
			let rank = getRank(segmentLineBefore, segmentLineAfter, i, Items.length)
			SegmentLines.update(segmentLineId(segmentId, itemId), {$set: {
				_rank: rank
			}})
		})
		*/
	}
	export function mosRundownStoryDelete (id: string, token: string, Action: MOS.IMOSROAction, Stories: Array<MOS.MosString128>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRundownStoryDelete ' + Action.RundownID)

		let rundown = getRO(Action.RundownID)
		if (!isAvailableForMOS(rundown)) return
		updateMosLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(Action, Stories)
		// Delete Stories (aka SegmentLine)
		let affectedSegmentLineIds: Array<string> = []
		_.each(Stories, (storyId: MOS.MosString128, i: number) => {
			logger.debug('remove story ' + storyId)
			let slId = segmentLineId(rundown._id, storyId)
			affectedSegmentLineIds.push(slId)
			removeSegmentLine(rundown._id, slId)
		})
		updateSegments(rundown._id)
		updateAffectedSegmentLines(rundown, affectedSegmentLineIds)
	}
	export function mosRundownItemDelete (id: string, token: string, Action: MOS.IMOSStoryAction, Items: Array<MOS.MosString128>) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRundownItemDelete NOT IMPLEMENTED YET ' + Action.StoryID)
		// @ts-ignore
		logger.debug(Action, Items)
		/*
		// Delete Items (aka SegmentLine ## TODO ##LinesLines)
		let rundown = getRO(Action.RundownID)
		_.each(Items, (itemId: MOS.MosString128, i: number) => {
			removeSegmentLine( segmentLineId(segmentId(rundown._id, Action.StoryID), itemId))
		})
		*/
	}
	export function mosRundownStorySwap (id: string, token: string, Action: MOS.IMOSROAction, StoryID0: MOS.MosString128, StoryID1: MOS.MosString128) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRundownStorySwap ' + StoryID0 + ', ' + StoryID1)

		let rundown = getRO(Action.RundownID)
		if (!isAvailableForMOS(rundown)) return
		updateMosLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(Action, StoryID0, StoryID1)
		// Swap Stories (aka SegmentLine)

		let segmentLine0 = getSegmentLine(Action.RundownID, StoryID0)
		let segmentLine1 = getSegmentLine(Action.RundownID, StoryID1)

		SegmentLines.update(segmentLine0._id, {$set: {_rank: segmentLine1._rank}})
		SegmentLines.update(segmentLine1._id, {$set: {_rank: segmentLine0._rank}})

		if (rundown.nextSegmentLineId === segmentLine0._id) {
			// Change nexted segmentLine
			ServerPlayoutAPI.rundownSetNext(rundown._id, segmentLine1._id)
		} else if (rundown.nextSegmentLineId === segmentLine1._id) {
			// Change nexted segmentLine
			ServerPlayoutAPI.rundownSetNext(rundown._id, segmentLine0._id)
		}

		updateSegments(rundown._id)
		updateAffectedSegmentLines(rundown, [segmentLine0._id, segmentLine1._id])
	}
	export function mosRundownItemSwap (id: string, token: string, Action: MOS.IMOSStoryAction, ItemID0: MOS.MosString128, ItemID1: MOS.MosString128) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.warn('mosRundownItemSwap NOT IMPLEMENTED YET ' + ItemID0 + ', ' + ItemID1)
		// @ts-ignore
		logger.debug(Action, ItemID0, ItemID1)
		/*
		// Swap Stories (aka SegmentLine ## TODO ##Lines)
		let rundown = getRO(Action.RundownID)

		let segmentLine0 = getSegmentLine(Action.RundownID, Action.StoryID, ItemID0)
		let segmentLine1 = getSegmentLine(Action.RundownID, Action.StoryID, ItemID1)

		Segments.update(segmentLine0._id, {$set: {_rank: segmentLine1._rank}})
		Segments.update(segmentLine1._id, {$set: {_rank: segmentLine0._rank}})
		*/
	}
	export function mosRundownReadyToAir (id: string, token: string, Action: MOS.IMOSROReadyToAir) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRundownReadyToAir ' + Action.ID)

		let rundown = getRO(Action.ID)
		if (!isAvailableForMOS(rundown)) return
		updateMosLastDataReceived(peripheralDevice._id)
		// @ts-ignore
		logger.debug(Action)
		// Set the ready to air status of a Rundown

		Rundowns.update(rundown._id, {$set: {
			airStatus: Action.Status
		}})

	}
	export function mosRundownFullStory (id: string, token: string, story: MOS.IMOSROFullStory ) {
		let peripheralDevice = PeripheralDeviceSecurity.getPeripheralDevice(id, token, this)
		logger.info('mosRundownFullStory ' + story.ID)

		let rundown = getRO(story.RundownId)
		if (!isAvailableForMOS(rundown)) return
		updateMosLastDataReceived(peripheralDevice._id)

		fixIllegalObject(story)
		// @ts-ignore
		// logger.debug(story)
		// Update db with the full story:
		// let segment = getSegment(story.RundownId, story.ID)
		let segmentLine = getSegmentLine(story.RundownId, story.ID)

		// cache the Data
		rundown.saveCache(CachePrefix.INGEST_PART + segmentLine._id, story)
		const changed = updateStory(rundown, segmentLine, story)

		const segment = segmentLine.getSegment()
		if (segment) {
			// this could be run after the segment, if we were capable of limiting that
			runPostProcessBlueprint(rundown, segment)
		}

		if (changed) {
			updateTimelineFromMosData(segmentLine.rundownId, [ segmentLine._id ])
		}
	}
}

let methods: Methods = {}
methods[PeripheralDeviceAPI.methods.mosRundownCreate] = (deviceId: string, deviceToken: string, rundown: MOS.IMOSRundown) => {
	return MosIntegration.mosRundownCreate(deviceId, deviceToken, rundown)
}
methods[PeripheralDeviceAPI.methods.mosRundownReplace] = (deviceId: string, deviceToken: string, rundown: MOS.IMOSRundown) => {
	return MosIntegration.mosRundownReplace(deviceId, deviceToken, rundown)
}
methods[PeripheralDeviceAPI.methods.mosRundownDelete] = (deviceId: string, deviceToken: string, rundownId: MOS.MosString128, force?: boolean) => {
	return MosIntegration.mosRundownDelete(deviceId, deviceToken, rundownId, force)
}
methods[PeripheralDeviceAPI.methods.mosRundownMetadata] = (deviceId: string, deviceToken: string, metadata: MOS.IMOSRundownBase) => {
	return MosIntegration.mosRundownMetadata(deviceId, deviceToken, metadata)
}
methods[PeripheralDeviceAPI.methods.mosRundownStatus] = (deviceId: string, deviceToken: string, status: MOS.IMOSRundownStatus) => {
	return MosIntegration.mosRundownStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRundownStoryStatus] = (deviceId: string, deviceToken: string, status: MOS.IMOSStoryStatus) => {
	return MosIntegration.mosRundownStoryStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRundownItemStatus] = (deviceId: string, deviceToken: string, status: MOS.IMOSItemStatus) => {
	return MosIntegration.mosRundownItemStatus(deviceId, deviceToken, status)
}
methods[PeripheralDeviceAPI.methods.mosRundownStoryInsert] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) => {
	return MosIntegration.mosRundownStoryInsert(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRundownItemInsert] = (deviceId: string, deviceToken: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) => {
	return MosIntegration.mosRundownItemInsert(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRundownStoryReplace] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.IMOSROStory>) => {
	return MosIntegration.mosRundownStoryReplace(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRundownItemReplace] = (deviceId: string, deviceToken: string, Action: MOS.IMOSItemAction, Items: Array<MOS.IMOSItem>) => {
	return MosIntegration.mosRundownItemReplace(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRundownStoryMove] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, Stories: Array<MOS.MosString128>) => {
	return MosIntegration.mosRundownStoryMove(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRundownItemMove] = (deviceId: string, deviceToken: string, Action: MOS.IMOSItemAction, Items: Array<MOS.MosString128>) => {
	return MosIntegration.mosRundownItemMove(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRundownStoryDelete] = (deviceId: string, deviceToken: string, Action: MOS.IMOSROAction, Stories: Array<MOS.MosString128>) => {
	return MosIntegration.mosRundownStoryDelete(deviceId, deviceToken, Action, Stories)
}
methods[PeripheralDeviceAPI.methods.mosRundownItemDelete] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, Items: Array<MOS.MosString128>) => {
	return MosIntegration.mosRundownItemDelete(deviceId, deviceToken, Action, Items)
}
methods[PeripheralDeviceAPI.methods.mosRundownStorySwap] = (deviceId: string, deviceToken: string, Action: MOS.IMOSROAction, StoryID0: MOS.MosString128, StoryID1: MOS.MosString128) => {
	return MosIntegration.mosRundownStorySwap(deviceId, deviceToken, Action, StoryID0, StoryID1)
}
methods[PeripheralDeviceAPI.methods.mosRundownItemSwap] = (deviceId: string, deviceToken: string, Action: MOS.IMOSStoryAction, ItemID0: MOS.MosString128, ItemID1: MOS.MosString128) => {
	return MosIntegration.mosRundownItemSwap(deviceId, deviceToken, Action, ItemID0, ItemID1)
}
methods[PeripheralDeviceAPI.methods.mosRundownReadyToAir] = (deviceId: string, deviceToken: string, Action: MOS.IMOSROReadyToAir) => {
	return MosIntegration.mosRundownReadyToAir(deviceId, deviceToken, Action)
}
methods[PeripheralDeviceAPI.methods.mosRundownFullStory] = (deviceId: string, deviceToken: string, story: MOS.IMOSROFullStory) => {
	return MosIntegration.mosRundownFullStory(deviceId, deviceToken, story)
}
// Apply methods:
setMeteorMethods(methods)

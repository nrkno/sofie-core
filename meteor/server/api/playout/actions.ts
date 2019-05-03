import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { IConfigItem } from 'tv-automation-sofie-blueprints-integration'
import { logger } from '../../logging'
import { Rundown, Rundowns, RundownHoldState } from '../../../lib/collections/Rundowns'
import { Parts } from '../../../lib/collections/Parts'
import { ServerPlayoutAPI } from './playout'
import { Studio } from '../../../lib/collections/Studios'
import { PeripheralDevices, PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { getCurrentTime } from '../../../lib/lib'
import { getBlueprintOfRundown } from '../blueprints/cache'
import { RundownContext } from '../blueprints/context'
import { setNextPart, onPartHasStoppedPlaying } from './lib'
import { updateTimeline } from './timeline'
import { RundownBaselineObjs } from '../../../lib/collections/RundownBaselineObjs'
import { RundownBaselineAdLibPieces } from '../../../lib/collections/RundownBaselineAdLibPieces'
import { IngestActions } from '../ingest/actions'
import { areThereActiveRundownsInStudio } from './studio'

export function activateRundown (rundown: Rundown, rehearsal: boolean) {
	logger.info('Activating rundown ' + rundown._id + (rehearsal ? ' (Rehearsal)' : ''))

	rehearsal = !!rehearsal
	// if (rundown.active && !rundown.rehearsal) throw new Meteor.Error(403, `Rundown "${rundown._id}" is active and not in rehersal, cannot reactivate!`)

	let newRundown = Rundowns.findOne(rundown._id) // fetch new from db, to make sure its up to date

	if (!newRundown) throw new Meteor.Error(404, `Rundown "${rundown._id}" not found!`)
	rundown = newRundown

	let studio = rundown.getStudio()

	const anyOtherActiveRundowns = areThereActiveRundownsInStudio(studio._id, rundown._id)

	if (anyOtherActiveRundowns.length) {
		// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
		throw new Meteor.Error(409, 'Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
	}

	let m = {
		active: true,
		rehearsal: rehearsal,
	}
	Rundowns.update(rundown._id, {
		$set: m
	})
	// Update local object:
	rundown.active = true
	rundown.rehearsal = rehearsal

	if (!rundown.nextPartId) {
		let parts = rundown.getParts()
		let firstPart = _.first(parts)
		if (firstPart && !firstPart.invalid) {
			setNextPart(rundown, firstPart)
		}
	}

	updateTimeline(studio._id)

	Meteor.defer(() => {
		const { blueprint } = getBlueprintOfRundown(rundown)
		if (blueprint.onRundownActivate) {
			Promise.resolve(blueprint.onRundownActivate(new RundownContext(rundown, studio)))
			.catch(logger.error)
		}
	})
}
export function deactivateRundown (rundown: Rundown) {
	logger.info('Deactivating rundown ' + rundown._id)

	let previousPart = (rundown.currentPartId ?
		Parts.findOne(rundown.currentPartId)
		: null
	)

	if (previousPart) onPartHasStoppedPlaying(previousPart, getCurrentTime())

	Rundowns.update(rundown._id, {
		$set: {
			active: false,
			previousPartId: null,
			currentPartId: null,
			holdState: RundownHoldState.NONE,
		}
	})
	setNextPart(rundown, null)
	if (rundown.currentPartId) {
		Parts.update(rundown.currentPartId, {
			$push: {
				'timings.takeOut': getCurrentTime()
			}
		})
	}

	// clean up all runtime baseline objects
	RundownBaselineObjs.remove({
		rundownId: rundown._id
	})

	RundownBaselineAdLibPieces.remove({
		rundownId: rundown._id
	})

	updateTimeline(rundown.studioId)

	IngestActions.notifyCurrentPlayingPart(rundown, null)

	Meteor.defer(() => {
		const { blueprint } = getBlueprintOfRundown(rundown)
		if (blueprint.onRundownDeActivate) {
			Promise.resolve(blueprint.onRundownDeActivate(new RundownContext(rundown)))
			.catch(logger.error)
		}
	})
}
export function prepareStudioForBroadcast (studio: Studio) {
	logger.info('prepareStudioForBroadcast ' + studio._id)

	const ssrcBgs: Array<IConfigItem> = _.compact([
		studio.config.find((o) => o._id === 'atemSSrcBackground'),
		studio.config.find((o) => o._id === 'atemSSrcBackground2')
	])
	if (ssrcBgs.length > 1) logger.info(ssrcBgs[0].value + ' and ' + ssrcBgs[1].value + ' will be loaded to atems')
	if (ssrcBgs.length > 0) logger.info(ssrcBgs[0].value + ' will be loaded to atems')

	let playoutDevices = PeripheralDevices.find({
		studioId: studio._id,
		type: PeripheralDeviceAPI.DeviceType.PLAYOUT
	}).fetch()

	_.each(playoutDevices, (device: PeripheralDevice) => {
		let okToDestoryStuff = true
		PeripheralDeviceAPI.executeFunction(device._id, (err) => {
			if (err) {
				logger.error(err)
			} else {
				logger.info('devicesMakeReady OK')
			}
		}, 'devicesMakeReady', okToDestoryStuff)

		if (ssrcBgs.length > 0) {
			PeripheralDeviceAPI.executeFunction(device._id, (err) => {
				if (err) {
					logger.error(err)
				} else {
					logger.info('Added Super Source BG to Atem')
				}
			}, 'uploadFileToAtem', ssrcBgs)
		}
	})
}

import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { IConfigItem } from 'tv-automation-sofie-blueprints-integration'
import { logger } from '../../logging'
import { Rundown, Rundowns, RundownHoldState } from '../../../lib/collections/Rundowns'
import { Parts } from '../../../lib/collections/Parts'
import { Studio } from '../../../lib/collections/Studios'
import { PeripheralDevices, PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import { PeripheralDeviceAPI } from '../../../lib/api/peripheralDevice'
import { getCurrentTime } from '../../../lib/lib'
import { getBlueprintOfRundown } from '../blueprints/cache'
import { RundownContext } from '../blueprints/context'
import { setNextPart, onPartHasStoppedPlaying } from './lib'
import { updateTimeline } from './timeline'
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
		throw new Meteor.Error(409, 'Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id), _.map(anyOtherActiveRundowns, rundown => rundown._id).join(','))
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
		if (firstPart && !firstPart.invalid && !firstPart.floated) {
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

	deactivateRundownInner(rundown)

	updateTimeline(rundown.studioId)

	Meteor.defer(() => {
		const { blueprint } = getBlueprintOfRundown(rundown)
		if (blueprint.onRundownDeActivate) {
			Promise.resolve(blueprint.onRundownDeActivate(new RundownContext(rundown)))
			.catch(logger.error)
		}
	})
}
export function deactivateRundownInner (rundown: Rundown) {
	logger.info('Deactivating rundown ' + rundown._id)

	const previousPart = (rundown.currentPartId ?
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
	setNextPart(rundown, null, null)

	if (rundown.currentPartId) {
		Parts.update(rundown.currentPartId, {
			$push: {
				'timings.takeOut': getCurrentTime()
			}
		})
	}

	IngestActions.notifyCurrentPlayingPart(rundown, null)
}
/**
 * Prepares studio before a broadcast is about to start
 * @param studio
 * @param okToDestoryStuff true if we're not ON AIR, things might flicker on the output
 */
export function prepareStudioForBroadcast (studio: Studio, okToDestoryStuff: boolean, rundownToBeActivated: Rundown) {
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
		PeripheralDeviceAPI.executeFunction(device._id, (err) => {
			if (err) {
				logger.error(err)
			} else {
				logger.info('devicesMakeReady OK')
			}
		}, 'devicesMakeReady', okToDestoryStuff, rundownToBeActivated._id)

		if (okToDestoryStuff) {
			if (ssrcBgs.length > 0) {
				PeripheralDeviceAPI.executeFunction(device._id, (err) => {
					if (err) {
						logger.error(err)
					} else {
						logger.info('Added Super Source BG to Atem')
					}
				}, 'uploadFileToAtem', ssrcBgs)
			}
		}
	})
}
/**
 * Makes a studio "stand down" after a broadcast
 * @param studio
 * @param okToDestoryStuff true if we're not ON AIR, things might flicker on the output
 */
export function standDownStudio (studio: Studio, okToDestoryStuff: boolean) {
	logger.info('standDownStudio ' + studio._id)

	let playoutDevices = PeripheralDevices.find({
		studioId: studio._id,
		type: PeripheralDeviceAPI.DeviceType.PLAYOUT
	}).fetch()

	_.each(playoutDevices, (device: PeripheralDevice) => {
		PeripheralDeviceAPI.executeFunction(device._id, (err) => {
			if (err) {
				logger.error(err)
			} else {
				logger.info('devicesStandDown OK')
			}
		}, 'devicesStandDown', okToDestoryStuff)
	})
}

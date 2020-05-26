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
import { setNextPart, onPartHasStoppedPlaying, selectNextPart } from './lib'
import { updateTimeline } from './timeline'
import { IngestActions } from '../ingest/actions'
import { areThereActiveRundownPlaylistsInStudio } from './studio'
import { RundownPlaylists, RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { PartInstances } from '../../../lib/collections/PartInstances'

export function activateRundownPlaylist (rundownPlaylist: RundownPlaylist, rehearsal: boolean) {
	logger.info('Activating rundown ' + rundownPlaylist._id + (rehearsal ? ' (Rehearsal)' : ''))

	rehearsal = !!rehearsal
	if (rundown.active && !rundown.rehearsal) throw new Meteor.Error(403, `Rundown "${rundown._id}" is active and not in rehersal, cannot reactivate!`)

	let newRundown = RundownPlaylists.findOne(rundownPlaylist._id) // fetch new from db, to make sure its up to date

	if (!newRundown) throw new Meteor.Error(404, `Rundown "${rundownPlaylist._id}" not found!`)
	rundownPlaylist = newRundown

	let studio = rundownPlaylist.getStudio()

	const anyOtherActiveRundowns = areThereActiveRundownPlaylistsInStudio(studio._id, rundownPlaylist._id)

	if (anyOtherActiveRundowns.length) {
		// logger.warn('Only one rundown can be active at the same time. Active rundowns: ' + _.map(anyOtherActiveRundowns, rundown => rundown._id))
		throw new Meteor.Error(
			409,
			'Only one rundown can be active at the same time. Active rundown playlists: ' +
				_.map(anyOtherActiveRundowns, playlist => playlist._id),
			JSON.stringify(_.map(anyOtherActiveRundowns, playlist => playlist._id)))
	}

	let m = {
		active: true,
		rehearsal: rehearsal,
	}
	RundownPlaylists.update(rundownPlaylist._id, {
		$set: m
	})
	// Update local object:
	rundownPlaylist.active = true
	rundownPlaylist.rehearsal = rehearsal

	let rundown: Rundown | undefined

	if (!rundownPlaylist.nextPartInstanceId) {
		const firstPart = selectNextPart(rundownPlaylist, null, rundownPlaylist.getAllOrderedParts())
		setNextPart(rundownPlaylist, firstPart ? firstPart.part : null)
	} else {
		const nextPartInstance = PartInstances.findOne(rundownPlaylist.nextPartInstanceId)
		if (!nextPartInstance) throw new Meteor.Error(404, `Could not find nextPartInstanceId "${rundownPlaylist.nextPartInstanceId}"`)
		rundown = Rundowns.findOne(nextPartInstance.rundownId)
		if (!rundown) throw new Meteor.Error(404, `Could not find rundown "${nextPartInstance.rundownId}"`)
	}

	updateTimeline(studio._id)

	Meteor.defer(() => {
		if (!rundown) return // if the proper rundown hasn't been found, there's little point doing anything else
		const { blueprint } = getBlueprintOfRundown(rundown)
		if (blueprint.onRundownActivate) {
			Promise.resolve(blueprint.onRundownActivate(new RundownContext(rundown, undefined, studio)))
			.catch(logger.error)
		}
	})
}
export function deactivateRundownPlaylist (rundownPlaylist: RundownPlaylist) {

	const rundown = deactivateRundownPlaylistInner(rundownPlaylist)

	updateTimeline(rundownPlaylist.studioId)


	Meteor.defer(() => {
		if (rundown) {
			const { blueprint } = getBlueprintOfRundown(rundown)
			if (blueprint.onRundownDeActivate) {
				Promise.resolve(blueprint.onRundownDeActivate(new RundownContext(rundown, undefined)))
				.catch(logger.error)
			}
		}
	})
}
export function deactivateRundownPlaylistInner (rundownPlaylist: RundownPlaylist): Rundown | undefined {
	logger.info(`Deactivating rundown playlist "${rundownPlaylist._id}"`)

	const { previousPartInstance, nextPartInstance } = rundownPlaylist.getSelectedPartInstances()

	let rundown: Rundown | undefined
	if (previousPartInstance) {

		// defer so that an error won't prevent deactivate
		Meteor.setTimeout(() => {
			rundown = Rundowns.findOne(previousPartInstance.rundownId)

			if (rundown) {
				IngestActions.notifyCurrentPlayingPart(rundown, null)
			} else {
				logger.error(`Could not find owner Rundown "${previousPartInstance.rundownId}" of PartInstance "${previousPartInstance._id}"`)
			}
		}, 40)
	} else {
		if (nextPartInstance) {
			rundown = Rundowns.findOne(nextPartInstance.rundownId)
		}
	}

	if (previousPartInstance) onPartHasStoppedPlaying(previousPartInstance, getCurrentTime())

	RundownPlaylists.update(rundownPlaylist._id, {
		$set: {
			active: false,
			previousPartInstanceId: null,
			currentPartInstanceId: null,
			holdState: RundownHoldState.NONE,
		}
	})
	rundownPlaylist.currentPartInstanceId = null
	rundownPlaylist.previousPartInstanceId = null
	setNextPart(rundownPlaylist, null)

	if (previousPartInstance) {
		PartInstances.update(previousPartInstance._id, {
			$push: {
				'part.timings.takeOut': getCurrentTime()
			}
		})

		// TODO-PartInstance - pending new data flow
		Parts.update(previousPartInstance.part._id, {
			$push: {
				'timings.takeOut': getCurrentTime()
			}
		})
	}
	return rundown
}
/**
 * Prepares studio before a broadcast is about to start
 * @param studio
 * @param okToDestoryStuff true if we're not ON AIR, things might flicker on the output
 */
export function prepareStudioForBroadcast (studio: Studio, okToDestoryStuff: boolean, rundownPlaylistToBeActivated: RundownPlaylist) {
	logger.info('prepareStudioForBroadcast ' + studio._id)

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
		}, 'devicesMakeReady', okToDestoryStuff, rundownPlaylistToBeActivated._id)
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

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
import { areThereActiveRundownPlaylistsInStudio } from './studio'
import { RundownPlaylists, RundownPlaylist } from '../../../lib/collections/RundownPlaylists'

export function activateRundownPlaylist (rundownPlaylist: RundownPlaylist, rehearsal: boolean) {
	logger.info('Activating rundown ' + rundownPlaylist._id + (rehearsal ? ' (Rehearsal)' : ''))

	rehearsal = !!rehearsal
	// if (rundown.active && !rundown.rehearsal) throw new Meteor.Error(403, `Rundown "${rundown._id}" is active and not in rehersal, cannot reactivate!`)

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

	if (!rundownPlaylist.nextPartId) {
		const rundowns = rundownPlaylist.getRundowns()
		rundown = _.first(rundowns)
		if (!rundown) throw new Meteor.Error(406, `The rundown playlist was empty, could not find a suitable part.`)
		const parts = rundown.getParts()
		const firstPart = _.first(parts)
		if (firstPart && !firstPart.invalid) {
			setNextPart(rundownPlaylist, firstPart)
		}
	} else {
		const nextPart = Parts.findOne(rundownPlaylist.nextPartId)
		if (!nextPart) throw new Meteor.Error(404, `Could not find nextPartId "${rundownPlaylist.nextPartId}"`)
		rundown = Rundowns.findOne(nextPart.rundownId)
		if (!rundown) throw new Meteor.Error(404, `Could not find rundown "${nextPart.rundownId}"`)
	}

	updateTimeline(studio._id)

	Meteor.defer(() => {
		if (!rundown) return // if the proper rundown hasn't been found, there's little point doing anything else
		const { blueprint } = getBlueprintOfRundown(rundown)
		if (blueprint.onRundownActivate) {
			Promise.resolve(blueprint.onRundownActivate(new RundownContext(rundown, studio)))
			.catch(logger.error)
		}
	})
}
export function deactivateRundownPlaylist (rundownPlaylist: RundownPlaylist) {
	logger.info(`Deactivating rundown playlist "${rundownPlaylist._id}"`)

	let previousPart = (rundownPlaylist.currentPartId ?
		Parts.findOne(rundownPlaylist.currentPartId)
		: null
	)

	if (previousPart) onPartHasStoppedPlaying(previousPart, getCurrentTime())

	RundownPlaylists.update(rundownPlaylist._id, {
		$set: {
			active: false,
			previousPartId: null,
			currentPartId: null,
			holdState: RundownHoldState.NONE,
		}
	})
	setNextPart(rundownPlaylist, null)
	if (rundownPlaylist.currentPartId) {
		Parts.update(rundownPlaylist.currentPartId, {
			$push: {
				'timings.takeOut': getCurrentTime()
			}
		})
	}

	updateTimeline(rundownPlaylist.studioId)

	let rundown: Rundown | undefined
	if (previousPart) {
		rundown = Rundowns.findOne(previousPart.rundownId)

		if (rundown) {
			IngestActions.notifyCurrentPlayingPart(rundown, null)
		} else {
			logger.error(`Could not find owner rundown "${previousPart.rundownId}" of part "${previousPart._id}"`)
		}

	}

	if (!previousPart) {
		let nextPart = (rundownPlaylist.nextPartId ?
			Parts.findOne(rundownPlaylist.nextPartId)
			: null
		)

		if (nextPart) {
			rundown = Rundowns.findOne(nextPart.rundownId)
		}
	}

	Meteor.defer(() => {
		if (rundown) {
			const { blueprint } = getBlueprintOfRundown(rundown)
			if (blueprint.onRundownDeActivate) {
				Promise.resolve(blueprint.onRundownDeActivate(new RundownContext(rundown)))
				.catch(logger.error)
			}
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

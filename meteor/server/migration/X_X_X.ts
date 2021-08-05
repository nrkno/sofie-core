import _ from 'underscore'
import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { ensureCollectionProperty } from './lib'
import { CustomizableRegions } from '../../lib/collections/RundownLayouts'
import { RundownPlaylist, RundownPlaylists } from '../../lib/collections/RundownPlaylists'
import { objectPathGet } from '../../lib/lib'
import { PlaylistTimingType } from '@sofie-automation/blueprints-integration'
import { logger } from '../logging'
import { Rundown, Rundowns } from '../../lib/collections/Rundowns'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */
// Release X
export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	ensureCollectionProperty('RundownLayouts', { regionId: { $exists: false } }, 'regionId', CustomizableRegions.Shelf),
	{
		id: `RundownPlaylists.timing`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = RundownPlaylists.find({
				timing: {
					$exists: false,
				},
			}).fetch()
			let propertyMissing: string | boolean = false
			_.each(objects, (obj: any) => {
				const objValue = objectPathGet(obj, 'timing')
				if (!objValue) {
					propertyMissing = `timing is missing on ${obj._id}`
				}
			})
			// logger.info('')
			return propertyMissing
		},
		migrate: () => {
			const objects = RundownPlaylists.find({
				timing: {
					$exists: false,
				},
			}).fetch()
			_.each(objects, (obj: any) => {
				if (obj) {
					const m: Partial<RundownPlaylist> = {}
					m.timing = {
						type: PlaylistTimingType.ForwardTime,
						expectedStart: obj['expectedStart'],
						expectedDuration: obj['expectedDuration'],
					}
					logger.info(
						`Migration: Setting RundownPlaylists object "${obj._id}".timing to values from deprecated fields.`
					)
					RundownPlaylists.update(obj._id, { $set: m })
				}
			})
		},
	},
	{
		id: `Rundowns.timing`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = Rundowns.find({
				timing: {
					$exists: false,
				},
			}).fetch()
			let propertyMissing: string | boolean = false
			_.each(objects, (obj: any) => {
				const objValue = objectPathGet(obj, 'timing')
				if (!objValue) {
					propertyMissing = `timing is missing on ${obj._id}`
				}
			})
			// logger.info('')
			return propertyMissing
		},
		migrate: () => {
			const objects = Rundowns.find({
				timing: {
					$exists: false,
				},
			}).fetch()
			_.each(objects, (obj: any) => {
				if (obj) {
					const m: Partial<Rundown> = {}
					m.timing = {
						type: PlaylistTimingType.ForwardTime,
						expectedStart: obj['expectedStart'],
						expectedDuration: obj['expectedDuration'],
					}
					logger.info(
						`Migration: Setting Rundown object "${obj._id}".timing to values from deprecated fields.`
					)
					Rundowns.update(obj._id, { $set: m })
				}
			})
		},
	},
])

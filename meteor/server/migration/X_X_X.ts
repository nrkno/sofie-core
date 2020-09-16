import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { Studios } from '../../lib/collections/Studios'
import { Timeline } from '../../lib/collections/Timeline'

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
	//                     ^--- To be set to an absolute version number when doing the release
	// add steps here:
	// {
	// 	id: 'my fancy step',
	// 	canBeRunAutomatically: true,
	// 	validate: () => {
	// 		return false
	// 	},
	// 	migrate: () => {
	// 		//
	// 	}
	// },
	//
	//
	// setExpectedVersion('expectedVersion.playoutDevice',	PeripheralDeviceAPI.DeviceType.PLAYOUT,			'_process', '^1.0.0'),
	// setExpectedVersion('expectedVersion.mosDevice',		PeripheralDeviceAPI.DeviceType.MOS,				'_process', '^1.0.0'),
	// setExpectedVersion('expectedVersion.mediaManager',	PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER,	'_process', '^1.0.0'),

	{
		id: 'Drop Studio Recording config',
		canBeRunAutomatically: true,
		validate: () => {
			const badCount = Studios.find({
				'testToolsConfig.recording': { $exists: true },
			}).count()
			if (badCount > 0) {
				return `${badCount} studio need to be updated`
			}
			return false
		},
		migrate: () => {
			Timeline.update(
				{
					'testToolsConfig.recording': { $exists: true },
				},
				{
					$unset: {
						'testToolsConfig.recording': 1,
					},
				}
			)
		},
	},
	{
		id: 'Single timeline object',
		canBeRunAutomatically: true,
		validate: () => {
			const badCount = Timeline.find({
				timeline: { $exists: false },
			}).count()
			if (badCount > 0) {
				return `${badCount} timeline objects need to be deleted`
			}
			return false
		},
		migrate: () => {
			Timeline.remove({
				timeline: { $exists: false },
			})
		},
	},
])

import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { ShowStyleVariant, ShowStyleVariants } from '../../lib/collections/ShowStyleVariants'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */

export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	{
		id: 'Add missing ranks to ShowStyleVariants',
		canBeRunAutomatically: true,
		validate: () => {
			return (
				ShowStyleVariants.find({
					_rank: { $exists: false },
				}).count() > 0
			)
		},
		migrate: () => {
			ShowStyleVariants.find({
				_rank: { $exists: false },
			}).forEach((variant: ShowStyleVariant, index: number) => {
				ShowStyleVariants.upsert(variant._id, {
					$set: {
						_rank: index,
					},
				})
			})
		},
	},
])

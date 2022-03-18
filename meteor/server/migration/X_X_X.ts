import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { RundownBaselineObjs } from '../../lib/collections/RundownBaselineObjs'
import { serializePieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { Pieces } from '../../lib/collections/Pieces'
import { AdLibPieces } from '../../lib/collections/AdLibPieces'
import { BucketAdLibs } from '../../lib/collections/BucketAdlibs'
import { PieceInstances } from '../../lib/collections/PieceInstances'
import { RundownBaselineAdLibPieces } from '../../lib/collections/RundownBaselineAdLibPieces'
import { StudioRouteType, Studios } from '../../lib/collections/Studios'

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
	// Add some migrations!

	{
		id: `RundownBaselineObj.timelineObjectsString`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = RundownBaselineObjs.find({
				timelineObjects: { $exists: true },
			}).count()
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = RundownBaselineObjs.find({
				timelineObjects: { $exists: true },
			}).fetch()
			for (const obj of objects) {
				RundownBaselineObjs.update(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob((obj as any).timelineObjects),
					},
					$unset: {
						timelineObjects: 1,
					},
				})
			}
		},
	},
	{
		id: `Pieces.timelineObjectsString`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = Pieces.find({
				'content.timelineObjects': { $exists: true },
			}).count()
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = Pieces.find({
				'content.timelineObjects': { $exists: true },
			}).fetch()
			for (const obj of objects) {
				Pieces.update(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob((obj as any).content.timelineObjects),
					},
					$unset: {
						'content.timelineObjects': 1,
					},
				})
			}
		},
	},
	{
		id: `AdLibPieces.timelineObjectsString`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = AdLibPieces.find({
				'content.timelineObjects': { $exists: true },
			}).count()
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = AdLibPieces.find({
				'content.timelineObjects': { $exists: true },
			}).fetch()
			for (const obj of objects) {
				AdLibPieces.update(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob((obj as any).content.timelineObjects),
					},
					$unset: {
						'content.timelineObjects': 1,
					},
				})
			}
		},
	},
	{
		id: `RundownBaselineAdLibPieces.timelineObjectsString`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = RundownBaselineAdLibPieces.find({
				'content.timelineObjects': { $exists: true },
			}).count()
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = RundownBaselineAdLibPieces.find({
				'content.timelineObjects': { $exists: true },
			}).fetch()
			for (const obj of objects) {
				RundownBaselineAdLibPieces.update(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob((obj as any).content.timelineObjects),
					},
					$unset: {
						'content.timelineObjects': 1,
					},
				})
			}
		},
	},
	{
		id: `BucketAdLibs.timelineObjectsString`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = BucketAdLibs.find({
				'content.timelineObjects': { $exists: true },
			}).count()
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = BucketAdLibs.find({
				'content.timelineObjects': { $exists: true },
			}).fetch()
			for (const obj of objects) {
				BucketAdLibs.update(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob((obj as any).content.timelineObjects),
					},
					$unset: {
						'content.timelineObjects': 1,
					},
				})
			}
		},
	},
	{
		id: `PieceInstances.timelineObjectsString`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = PieceInstances.find({
				'piece.content.timelineObjects': { $exists: true },
			}).count()
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = PieceInstances.find({
				'piece.content.timelineObjects': { $exists: true },
			}).fetch()
			for (const obj of objects) {
				PieceInstances.update(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob(
							(obj as any).piece.content.timelineObjects
						),
					},
					$unset: {
						'piece.content.timelineObjects': 1,
					},
				})
			}
		},
	},

	{
		id: 'Add new routeType property to routeSets where missing',
		canBeRunAutomatically: true,
		validate: () => {
			return (
				Studios.find({
					routeSets: { $exists: false },
				}).count() > 0
			)
		},
		migrate: () => {
			Studios.find({}).forEach((studio) => {
				const routeSets = studio.routeSets

				Object.entries(routeSets).forEach(([routeSetId, routeSet]) => {
					routeSet.routes.forEach((route) => {
						if (!route.routeType) {
							route.routeType = StudioRouteType.REROUTE
						}
					})

					routeSets[routeSetId] = routeSet
				})

				Studios.update(studio._id, { $set: { routeSets } })
			})
		},
	},
])

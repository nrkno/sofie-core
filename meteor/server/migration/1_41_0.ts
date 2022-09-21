import { addMigrationSteps } from './databaseMigration'
import { RundownBaselineObjs } from '../../lib/collections/RundownBaselineObjs'
import { serializePieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { Pieces } from '../../lib/collections/Pieces'
import { AdLibPieces } from '../../lib/collections/AdLibPieces'
import { BucketAdLibs } from '../../lib/collections/BucketAdlibs'
import { PieceInstances } from '../../lib/collections/PieceInstances'
import { RundownBaselineAdLibPieces } from '../../lib/collections/RundownBaselineAdLibPieces'
import { TimelineObjGeneric } from '@sofie-automation/corelib/dist/dataModel/Timeline'

// Release 41
export const addSteps = addMigrationSteps('1.41.0', [
	{
		id: `RundownBaselineObj.timelineObjectsString from objects`,
		canBeRunAutomatically: true,
		validate: () => {
			const objects = RundownBaselineObjs.find({
				objects: { $exists: true },
			}).count()
			if (objects > 0) {
				return `timelineObjects needs to be converted`
			}
			return false
		},
		migrate: () => {
			const objects = RundownBaselineObjs.find({
				objects: { $exists: true },
			}).fetch()
			for (const obj of objects) {
				RundownBaselineObjs.update(obj._id, {
					$set: {
						timelineObjectsString: serializePieceTimelineObjectsBlob(
							(obj as any).objects as TimelineObjGeneric[]
						),
					},
					$unset: {
						objects: 1,
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
])

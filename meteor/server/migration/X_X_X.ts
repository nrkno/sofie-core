import { addMigrationSteps } from './databaseMigration'
import { CURRENT_SYSTEM_VERSION } from './currentSystemVersion'
import { AdLibActions, AdLibPieces, ExpectedPackages, Pieces } from '../collections'
import { ExpectedPackageDBType } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import _ from 'underscore'
import {
	AdLibActionId,
	PartId,
	PieceId,
	RundownBaselineAdLibActionId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { protectString } from '@sofie-automation/corelib/dist/protectedString'

/*
 * **************************************************************************************
 *
 *  These migrations are destined for the next release
 *
 * (This file is to be renamed to the correct version number when doing the release)
 *
 * **************************************************************************************
 */

const EXPECTED_PACKAGE_TYPES_ADDED_PART_ID = [
	ExpectedPackageDBType.PIECE,
	ExpectedPackageDBType.ADLIB_PIECE,
	ExpectedPackageDBType.ADLIB_ACTION,
]

export const addSteps = addMigrationSteps(CURRENT_SYSTEM_VERSION, [
	// Add your migration here

	{
		id: `ExpectedPackageDBFromAdLibAction and ExpectedPackageDBFromPiece add partId`,
		canBeRunAutomatically: true,
		validate: async () => {
			const objectCount = await ExpectedPackages.countDocuments({
				fromPieceType: { $in: EXPECTED_PACKAGE_TYPES_ADDED_PART_ID },
				partId: { $exists: false },
			})

			if (objectCount) {
				return `object needs to be updated`
			}
			return false
		},
		migrate: async () => {
			const objects = await ExpectedPackages.findFetchAsync({
				fromPieceType: { $in: EXPECTED_PACKAGE_TYPES_ADDED_PART_ID },
				partId: { $exists: false },
			})

			const neededPieceIds: Array<PieceId | AdLibActionId | RundownBaselineAdLibActionId> = _.compact(
				objects.map((obj) => obj.pieceId)
			)
			const [pieces, adlibPieces, adlibActions] = await Promise.all([
				Pieces.findFetchAsync(
					{
						_id: { $in: neededPieceIds as PieceId[] },
					},
					{
						projection: {
							_id: 1,
							startPartId: 1,
						},
					}
				) as Promise<Pick<Piece, '_id' | 'startPartId'>[]>,
				AdLibPieces.findFetchAsync(
					{
						_id: { $in: neededPieceIds as PieceId[] },
					},
					{
						projection: {
							_id: 1,
							partId: 1,
						},
					}
				) as Promise<Pick<AdLibPiece, '_id' | 'partId'>[]>,
				AdLibActions.findFetchAsync(
					{
						_id: { $in: neededPieceIds as AdLibActionId[] },
					},
					{
						projection: {
							_id: 1,
							partId: 1,
						},
					}
				) as Promise<Pick<AdLibAction, '_id' | 'partId'>[]>,
			])

			const partIdLookup = new Map<PieceId | AdLibActionId | RundownBaselineAdLibActionId, PartId>()
			for (const piece of pieces) {
				partIdLookup.set(piece._id, piece.startPartId)
			}
			for (const adlib of adlibPieces) {
				if (adlib.partId) partIdLookup.set(adlib._id, adlib.partId)
			}
			for (const action of adlibActions) {
				partIdLookup.set(action._id, action.partId)
			}

			for (const expectedPackage of objects) {
				if (!expectedPackage.pieceId) continue

				await ExpectedPackages.mutableCollection.updateAsync(expectedPackage._id, {
					$set: {
						partId: partIdLookup.get(expectedPackage.pieceId) ?? protectString(''),
					},
				})
			}
		},
	},
])

import { addMigrationSteps, CURRENT_SYSTEM_VERSION } from './databaseMigration'
import { Studios } from '../../lib/collections/Studios'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { ShowStyleBases } from '../../lib/collections/ShowStyleBases'
import { CoreSystem } from '../../lib/collections/CoreSystem'
import { Pieces } from '../../lib/collections/Pieces'
import { Part, Parts } from '../../lib/collections/Parts'
import { Piece as Piece_1_11_0 } from './deprecatedDataTypes/1_11_0'
import { unprotectString } from '../../lib/lib'

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
addMigrationSteps(CURRENT_SYSTEM_VERSION, [
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
	{
		id: 'Studios: Default organizationId',
		canBeRunAutomatically: true,
		validate: () => {
			if (
				Studios.findOne({
					organizationId: { $exists: false },
				})
			)
				return 'Studio without organizationId'
			return false
		},
		migrate: () => {
			// add organizationId: null
			Studios.update(
				{
					organizationId: { $exists: false },
				},
				{
					$set: {
						organizationId: null,
					},
				}
			)
		},
	},
	{
		id: 'PeripheralDevices: Default organizationId',
		canBeRunAutomatically: true,
		validate: () => {
			if (
				PeripheralDevices.findOne({
					organizationId: { $exists: false },
				})
			)
				return 'PeripheralDevice without organizationId'
			return false
		},
		migrate: () => {
			// add organizationId: null
			PeripheralDevices.update(
				{
					organizationId: { $exists: false },
				},
				{
					$set: {
						organizationId: null,
					},
				}
			)
		},
	},
	{
		id: 'ShowStyleBases: Default organizationId',
		canBeRunAutomatically: true,
		validate: () => {
			if (
				ShowStyleBases.findOne({
					organizationId: { $exists: false },
				})
			)
				return 'ShowStyleBase without organizationId'
			return false
		},
		migrate: () => {
			// add organizationId: null
			ShowStyleBases.update(
				{
					organizationId: { $exists: false },
				},
				{
					$set: {
						organizationId: null,
					},
				}
			)
		},
	},

	{
		id: 'Remove runtimeArguments from ShowStyleBase',
		canBeRunAutomatically: true,
		validate: () => {
			const studio = ShowStyleBases.find().fetch()
			let result: string | boolean = false
			studio.forEach((siItem) => {
				if ((siItem as any).runtimeArguments && (siItem as any).runtimeArguments.length > 0) {
					result = `Rundown Arguments set in a Studio Installation "${siItem._id}"`
				}
			})
			return result
		},
		migrate: () => {
			ShowStyleBases.update(
				{},
				{
					$unset: {
						runtimeArguments: 1,
					},
				}
			)
		},
	},
	{
		id: 'Pieces properties',
		canBeRunAutomatically: true,
		validate: () => {
			const pieceCount = Pieces.find({
				rundownId: { $exists: true },
				partId: { $exists: true },
			}).count()
			let result: string | boolean = false
			if (pieceCount > 0) result = `${pieceCount} pieces need to be migrated`

			return result
		},
		migrate: () => {
			const parts: { [partId: string]: Part } = {}
			Pieces.find({
				rundownId: { $exists: true },
				partId: { $exists: true },
			}).forEach((piece0) => {
				const piece = (piece0 as any) as Piece_1_11_0

				let part: Part | undefined = parts[unprotectString(piece.partId)]
				if (!part) {
					part = Parts.findOne(piece.partId)
					if (part) {
						parts[unprotectString(piece.partId)] = part
					}
				}
				if (part) {
					Pieces.update(piece._id, {
						$set: {
							startRundownId: piece.rundownId,
							startPartId: piece.partId,
							startSegmentId: part.segmentId,
						},
						$unset: {
							rundownId: 1,
							partId: 1,
						},
					})
				}
			})
		},
	},
	//
	//
	// setExpectedVersion('expectedVersion.playoutDevice',	PeripheralDeviceAPI.DeviceType.PLAYOUT,			'_process', '^1.0.0'),
	// setExpectedVersion('expectedVersion.mosDevice',		PeripheralDeviceAPI.DeviceType.MOS,				'_process', '^1.0.0'),
	// setExpectedVersion('expectedVersion.mediaManager',	PeripheralDeviceAPI.DeviceType.MEDIA_MANAGER,	'_process', '^1.0.0'),
])

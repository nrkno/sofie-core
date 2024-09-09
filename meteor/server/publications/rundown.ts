import { Meteor } from 'meteor/meteor'
import { meteorPublish, AutoFillSelector } from './lib'
import { MeteorPubSub } from '../../lib/api/pubsub'
import { MongoFieldSpecifierZeroes, MongoQuery } from '@sofie-automation/corelib/dist/mongo'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { RundownReadAccess } from '../security/rundown'
import { DBSegment } from '@sofie-automation/corelib/dist/dataModel/Segment'
import { DBPart } from '@sofie-automation/corelib/dist/dataModel/Part'
import { Piece } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { NoSecurityReadAccess } from '../security/noSecurity'
import { OrganizationReadAccess } from '../security/organization'
import { StudioReadAccess } from '../security/studio'
import { check, Match } from 'meteor/check'
import { FindOptions } from '../../lib/collections/lib'
import {
	AdLibActions,
	AdLibPieces,
	ExpectedPlayoutItems,
	IngestDataCache,
	PartInstances,
	Parts,
	PeripheralDevices,
	PieceInstances,
	Pieces,
	RundownBaselineAdLibActions,
	RundownBaselineAdLibPieces,
	Rundowns,
	Segments,
} from '../collections'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { IngestDataCacheObj } from '@sofie-automation/corelib/dist/dataModel/IngestDataCache'
import { literal } from '@sofie-automation/corelib/dist/lib'
import {
	PartId,
	PartInstanceId,
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistActivationId,
	RundownPlaylistId,
	SegmentId,
	SegmentPlayoutId,
	ShowStyleBaseId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { PeripheralDevicePubSub } from '@sofie-automation/shared-lib/dist/pubsub/peripheralDevice'
import { PeripheralDeviceReadAccess } from '../security/peripheralDevice'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { resolveCredentials } from '../security/lib/credentials'

meteorPublish(PeripheralDevicePubSub.rundownsForDevice, async function (deviceId, token: string | undefined) {
	check(deviceId, String)
	check(token, String)

	const { cred, selector } = await AutoFillSelector.organizationId<DBRundown>(this.userId, {}, token)

	// Future: this should be reactive to studioId changes, but this matches how the other *ForDevice publications behave

	// The above auth check may return nothing when security is disabled, but we need the return value
	const resolvedCred = cred?.device ? cred : await resolveCredentials({ userId: this.userId, token })
	if (!resolvedCred || !resolvedCred.device)
		throw new Meteor.Error(403, 'Publication can only be used by authorized PeripheralDevices')

	// No studio, then no rundowns
	if (!resolvedCred.device.studioId) return null

	selector.studioId = resolvedCred.device.studioId

	const modifier: FindOptions<DBRundown> = {
		fields: {
			privateData: 0,
		},
	}

	if (NoSecurityReadAccess.any() || (await StudioReadAccess.studioContent(selector.studioId, resolvedCred))) {
		return Rundowns.findWithCursor(selector, modifier)
	}
	return null
})

meteorPublish(
	CorelibPubSub.rundownsInPlaylists,
	async function (playlistIds: RundownPlaylistId[], token: string | undefined) {
		check(playlistIds, Array)

		// If values were provided, they must have values
		if (playlistIds.length === 0) return null

		const { cred, selector } = await AutoFillSelector.organizationId<DBRundown>(
			this.userId,
			{
				playlistId: { $in: playlistIds },
			},
			token
		)

		const modifier: FindOptions<DBRundown> = {
			fields: {
				privateData: 0,
			},
		}

		if (
			!cred ||
			NoSecurityReadAccess.any() ||
			(selector.organizationId &&
				(await OrganizationReadAccess.organizationContent(selector.organizationId, cred))) ||
			(selector.studioId && (await StudioReadAccess.studioContent(selector.studioId, cred))) ||
			(selector._id && (await RundownReadAccess.rundown(selector._id, cred)))
		) {
			return Rundowns.findWithCursor(selector, modifier)
		}
		return null
	}
)
meteorPublish(
	CorelibPubSub.rundownsWithShowStyleBases,
	async function (showStyleBaseIds: ShowStyleBaseId[], token: string | undefined) {
		check(showStyleBaseIds, Array)

		if (showStyleBaseIds.length === 0) return null

		const { cred, selector } = await AutoFillSelector.organizationId<DBRundown>(
			this.userId,
			{
				showStyleBaseId: { $in: showStyleBaseIds },
			},
			token
		)

		const modifier: FindOptions<DBRundown> = {
			fields: {
				privateData: 0,
			},
		}

		if (
			!cred ||
			NoSecurityReadAccess.any() ||
			(selector.organizationId &&
				(await OrganizationReadAccess.organizationContent(selector.organizationId, cred))) ||
			(selector.studioId && (await StudioReadAccess.studioContent(selector.studioId, cred))) ||
			(selector._id && (await RundownReadAccess.rundown(selector._id, cred)))
		) {
			return Rundowns.findWithCursor(selector, modifier)
		}
		return null
	}
)

meteorPublish(
	CorelibPubSub.segments,
	async function (rundownIds: RundownId[], filter: { omitHidden?: boolean } | undefined, token: string | undefined) {
		check(rundownIds, Array)

		if (rundownIds.length === 0) return null

		const selector: MongoQuery<DBSegment> = {
			rundownId: { $in: rundownIds },
		}
		if (filter?.omitHidden) selector.isHidden = { $ne: true }

		if (
			NoSecurityReadAccess.any() ||
			(await RundownReadAccess.rundownContent(selector.rundownId, { userId: this.userId, token }))
		) {
			return Segments.findWithCursor(selector, {
				fields: {
					privateData: 0,
				},
			})
		}
		return null
	}
)

meteorPublish(
	CorelibPubSub.parts,
	async function (rundownIds: RundownId[], segmentIds: SegmentId[] | null, token: string | undefined) {
		check(rundownIds, Array)
		check(segmentIds, Match.Maybe(Array))

		if (rundownIds.length === 0) return null
		if (segmentIds && segmentIds.length === 0) return null

		const modifier: FindOptions<DBPart> = {
			fields: {
				privateData: 0,
			},
		}

		const selector: MongoQuery<DBPart> = {
			rundownId: { $in: rundownIds },
			reset: { $ne: true },
		}
		if (segmentIds) selector.segmentId = { $in: segmentIds }

		if (
			NoSecurityReadAccess.any() ||
			(selector.rundownId &&
				(await RundownReadAccess.rundownContent(selector.rundownId, { userId: this.userId, token }))) // ||
			// (selector._id && await RundownReadAccess.pieces(selector._id, { userId: this.userId, token })) // TODO - the types for this did not match
		) {
			return Parts.findWithCursor(selector, modifier)
		}
		return null
	}
)
meteorPublish(
	CorelibPubSub.partInstances,
	async function (
		rundownIds: RundownId[],
		playlistActivationId: RundownPlaylistActivationId | null,
		token: string | undefined
	) {
		check(rundownIds, Array)
		check(playlistActivationId, Match.Maybe(String))

		if (rundownIds.length === 0 || !playlistActivationId) return null

		const modifier: FindOptions<DBPartInstance> = {
			fields: {
				// @ts-expect-error Mongo typings aren't clever enough yet
				'part.privateData': 0,
			},
		}

		const selector: MongoQuery<DBPartInstance> = {
			rundownId: { $in: rundownIds },
			reset: { $ne: true },
		}
		if (playlistActivationId) selector.playlistActivationId = playlistActivationId

		if (
			NoSecurityReadAccess.any() ||
			(await RundownReadAccess.rundownContent(selector.rundownId, { userId: this.userId, token }))
		) {
			return PartInstances.findWithCursor(selector, modifier)
		}
		return null
	}
)
meteorPublish(
	CorelibPubSub.partInstancesSimple,
	async function (
		rundownIds: RundownId[],
		playlistActivationId: RundownPlaylistActivationId | null,
		token: string | undefined
	) {
		check(rundownIds, Array)

		if (rundownIds.length === 0) return null

		const selector: MongoQuery<DBPartInstance> = {
			rundownId: { $in: rundownIds },
			// Enforce only not-reset
			reset: { $ne: true },
		}
		if (playlistActivationId) selector.playlistActivationId = playlistActivationId

		if (
			NoSecurityReadAccess.any() ||
			(await RundownReadAccess.rundownContent(selector.rundownId, { userId: this.userId, token }))
		) {
			return PartInstances.findWithCursor(selector, {
				fields: literal<MongoFieldSpecifierZeroes<DBPartInstance>>({
					// @ts-expect-error Mongo typings aren't clever enough yet
					'part.privateData': 0,
					isTaken: 0,
					timings: 0,
				}),
			})
		}
		return null
	}
)
meteorPublish(
	CorelibPubSub.partInstancesForSegmentPlayout,
	async function (rundownId: RundownId, segmentPlayoutId: SegmentPlayoutId, token: string | undefined) {
		if (!rundownId) throw new Meteor.Error(400, 'rundownId argument missing')
		if (!segmentPlayoutId) throw new Meteor.Error(400, 'segmentPlayoutId argument missing')

		if (
			NoSecurityReadAccess.any() ||
			(await RundownReadAccess.rundownContent(rundownId, { userId: this.userId, token }))
		) {
			return PartInstances.findWithCursor(
				{
					rundownId,
					segmentPlayoutId,
				},
				{
					fields: {
						// @ts-expect-error Mongo typings aren't clever enough yet
						'part.privateData': 0,
					},
					sort: {
						takeCount: 1,
					},
					limit: 1,
				}
			)
		}
		return null
	}
)

const piecesSubFields: MongoFieldSpecifierZeroes<Piece> = {
	privateData: 0,
	timelineObjectsString: 0,
}

meteorPublish(
	CorelibPubSub.pieces,
	async function (rundownIds: RundownId[], partIds: PartId[] | null, token: string | undefined) {
		check(rundownIds, Array)
		check(partIds, Match.Maybe(Array))

		// If values were provided, they must have values
		if (partIds && partIds.length === 0) return null

		const selector: MongoQuery<Piece> = {
			startRundownId: { $in: rundownIds },
		}
		if (partIds) selector.startPartId = { $in: partIds }

		if (
			NoSecurityReadAccess.any() ||
			(await RundownReadAccess.rundownContent(selector.startRundownId, { userId: this.userId, token }))
		) {
			return Pieces.findWithCursor(selector, {
				fields: piecesSubFields,
			})
		}
		return null
	}
)

meteorPublish(
	CorelibPubSub.piecesInfiniteStartingBefore,
	async function (
		thisRundownId: RundownId,
		segmentsIdsBefore: SegmentId[],
		rundownIdsBefore: RundownId[],
		_token: string | undefined
	) {
		// TODO - Fix this when security is enabled
		if (!NoSecurityReadAccess.any()) return null

		const selector: MongoQuery<Piece> = {
			invalid: {
				$ne: true,
			},
			$or: [
				// same rundown, and previous segment
				{
					startRundownId: thisRundownId,
					startSegmentId: { $in: segmentsIdsBefore },
					lifespan: {
						$in: [
							PieceLifespan.OutOnRundownEnd,
							PieceLifespan.OutOnRundownChange,
							PieceLifespan.OutOnShowStyleEnd,
						],
					},
				},
				// Previous rundown
				{
					startRundownId: { $in: rundownIdsBefore },
					lifespan: {
						$in: [PieceLifespan.OutOnShowStyleEnd],
					},
				},
			],
		}

		return Pieces.findWithCursor(selector, {
			fields: piecesSubFields,
		})
	}
)

const adlibPiecesSubFields: MongoFieldSpecifierZeroes<AdLibPiece> = {
	privateData: 0,
	timelineObjectsString: 0,
}

meteorPublish(CorelibPubSub.adLibPieces, async function (rundownIds: RundownId[], token: string | undefined) {
	check(rundownIds, Array)

	if (rundownIds.length === 0) return null

	const selector: MongoQuery<AdLibPiece> = {
		rundownId: { $in: rundownIds },
	}

	if (
		NoSecurityReadAccess.any() ||
		(await RundownReadAccess.rundownContent(selector.rundownId, { userId: this.userId, token }))
	) {
		return AdLibPieces.findWithCursor(selector, {
			fields: adlibPiecesSubFields,
		})
	}
	return null
})
meteorPublish(MeteorPubSub.adLibPiecesForPart, async function (partId: PartId, sourceLayerIds: string[]) {
	if (!partId) throw new Meteor.Error(400, 'partId argument missing')
	if (!sourceLayerIds) throw new Meteor.Error(400, 'sourceLayerIds argument missing')

	// Future: This needs some thought for a security enabled environment
	if (!NoSecurityReadAccess.any()) return null

	return AdLibPieces.findWithCursor(
		{
			partId,
			sourceLayerId: { $in: sourceLayerIds },
		},
		{
			fields: adlibPiecesSubFields,
		}
	)
})

const pieceInstanceFields: MongoFieldSpecifierZeroes<PieceInstance> = {
	// @ts-expect-error Mongo typings aren't clever enough yet
	'piece.privateData': 0,
	'piece.timelineObjectsString': 0,
}

meteorPublish(
	CorelibPubSub.pieceInstances,
	async function (
		rundownIds: RundownId[],
		partInstanceIds: PartInstanceId[] | null,
		filter:
			| {
					onlyPlayingAdlibsOrWithTags?: boolean
			  }
			| undefined,
		token: string | undefined
	) {
		check(rundownIds, Array)
		check(partInstanceIds, Match.Maybe(Array))

		// If values were provided, they must have values
		if (rundownIds.length === 0) return null
		if (partInstanceIds && partInstanceIds.length === 0) return null

		const selector: MongoQuery<PieceInstance> = {
			rundownId: { $in: rundownIds },

			// Enforce only not-reset
			reset: { $ne: true },
		}
		if (partInstanceIds) selector.partInstanceId = { $in: partInstanceIds }

		if (filter?.onlyPlayingAdlibsOrWithTags) {
			selector.plannedStartedPlayback = {
				$exists: true,
			}
			selector.$and = [
				{
					$or: [
						{
							adLibSourceId: {
								$exists: true,
							},
						},
						{
							'piece.tags': {
								$exists: true,
							},
						},
					],
				},
				{
					$or: [
						{
							plannedStoppedPlayback: {
								$eq: 0,
							},
						},
						{
							plannedStoppedPlayback: {
								$exists: false,
							},
						},
					],
				},
			]
		}

		if (
			NoSecurityReadAccess.any() ||
			(await RundownReadAccess.rundownContent(selector.rundownId, { userId: this.userId, token }))
		) {
			return PieceInstances.findWithCursor(selector, {
				fields: pieceInstanceFields,
			})
		}
		return null
	}
)

meteorPublish(
	CorelibPubSub.pieceInstancesSimple,
	async function (
		rundownIds: RundownId[],
		playlistActivationId: RundownPlaylistActivationId | null,
		token: string | undefined
	) {
		check(rundownIds, Array)

		if (rundownIds.length === 0) return null

		const selector: MongoQuery<PieceInstance> = {
			rundownId: { $in: rundownIds },
			// Enforce only not-reset
			reset: { $ne: true },
		}
		if (playlistActivationId) selector.playlistActivationId = playlistActivationId

		if (
			NoSecurityReadAccess.any() ||
			(await RundownReadAccess.rundownContent(selector.rundownId, { userId: this.userId, token }))
		) {
			return PieceInstances.findWithCursor(selector, {
				fields: literal<MongoFieldSpecifierZeroes<PieceInstance>>({
					...pieceInstanceFields,
					plannedStartedPlayback: 0,
					plannedStoppedPlayback: 0,
				}),
			})
		}
		return null
	}
)

meteorPublish(
	PeripheralDevicePubSub.expectedPlayoutItemsForDevice,
	async function (deviceId: PeripheralDeviceId, token: string | undefined) {
		if (!deviceId) throw new Meteor.Error(400, 'deviceId argument missing')
		check(deviceId, String)

		if (await PeripheralDeviceReadAccess.peripheralDeviceContent(deviceId, { userId: this.userId, token })) {
			const peripheralDevice = await PeripheralDevices.findOneAsync(deviceId)

			if (!peripheralDevice) throw new Meteor.Error(`PeripheralDevice "${deviceId}" not found`)

			const studioId = peripheralDevice.studioId
			if (!studioId) return null

			return ExpectedPlayoutItems.findWithCursor({ studioId })
		}
		return null
	}
)
// Note: this publication is for dev purposes only:
meteorPublish(
	CorelibPubSub.ingestDataCache,
	async function (selector: MongoQuery<IngestDataCacheObj>, token: string | undefined) {
		if (!selector) throw new Meteor.Error(400, 'selector argument missing')
		const modifier: FindOptions<IngestDataCacheObj> = {
			fields: {},
		}
		if (
			NoSecurityReadAccess.any() ||
			(await RundownReadAccess.rundownContent(selector.rundownId, { userId: this.userId, token }))
		) {
			return IngestDataCache.findWithCursor(selector, modifier)
		}
		return null
	}
)
meteorPublish(
	CorelibPubSub.rundownBaselineAdLibPieces,
	async function (rundownIds: RundownId[], token: string | undefined) {
		check(rundownIds, Array)

		if (rundownIds.length === 0) return null

		const selector: MongoQuery<RundownBaselineAdLibItem> = {
			rundownId: { $in: rundownIds },
		}

		if (
			NoSecurityReadAccess.any() ||
			(await RundownReadAccess.rundownContent(selector.rundownId, { userId: this.userId, token }))
		) {
			return RundownBaselineAdLibPieces.findWithCursor(selector, {
				fields: {
					timelineObjectsString: 0,
					privateData: 0,
				},
			})
		}
		return null
	}
)

const adlibActionSubFields: MongoFieldSpecifierZeroes<AdLibAction> = {
	privateData: 0,
}

meteorPublish(CorelibPubSub.adLibActions, async function (rundownIds: RundownId[], token: string | undefined) {
	check(rundownIds, Array)

	if (rundownIds.length === 0) return null

	const selector: MongoQuery<AdLibAction> = {
		rundownId: { $in: rundownIds },
	}

	if (
		NoSecurityReadAccess.any() ||
		(await RundownReadAccess.rundownContent(selector.rundownId, { userId: this.userId, token }))
	) {
		return AdLibActions.findWithCursor(selector, {
			fields: adlibActionSubFields,
		})
	}
	return null
})
meteorPublish(MeteorPubSub.adLibActionsForPart, async function (partId: PartId, sourceLayerIds: string[]) {
	if (!partId) throw new Meteor.Error(400, 'partId argument missing')
	if (!sourceLayerIds) throw new Meteor.Error(400, 'sourceLayerIds argument missing')

	// Future: This needs some thought for a security enabled environment
	if (!NoSecurityReadAccess.any()) return null

	return AdLibActions.findWithCursor(
		{
			partId,
			'display.sourceLayerId': { $in: sourceLayerIds },
		},
		{
			fields: adlibActionSubFields,
		}
	)
})

meteorPublish(
	CorelibPubSub.rundownBaselineAdLibActions,
	async function (rundownIds: RundownId[], token: string | undefined) {
		check(rundownIds, Array)

		if (rundownIds.length === 0) return null

		const selector: MongoQuery<RundownBaselineAdLibAction> = {
			rundownId: { $in: rundownIds },
		}

		if (
			NoSecurityReadAccess.any() ||
			(await RundownReadAccess.rundownContent(selector.rundownId, { userId: this.userId, token }))
		) {
			return RundownBaselineAdLibActions.findWithCursor(selector, {
				fields: adlibActionSubFields,
			})
		}
		return null
	}
)

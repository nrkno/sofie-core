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

meteorPublish(PeripheralDevicePubSub.rundownsForDevice, async function (deviceId, token: string | undefined) {
	check(deviceId, String)
	check(token, String)

	const { cred, selector } = await AutoFillSelector.organizationId<DBRundown>(this.userId, {}, token)

	// Future: this should be reactive to studioId changes, but this matches how the other *ForDevice publications behave

	if (!cred || !cred.device)
		throw new Meteor.Error(403, 'Publication can only be used by authorized PeripheralDevices')

	// No studio, then no rundowns
	if (!cred.device.studioId) return null

	selector.studioId = cred.device.studioId

	const modifier: FindOptions<DBRundown> = {
		fields: {
			metaData: 0,
		},
	}

	if (NoSecurityReadAccess.any() || (await StudioReadAccess.studioContent(selector.studioId, cred))) {
		return Rundowns.findWithCursor(selector, modifier)
	}
	return null
})

meteorPublish(
	CorelibPubSub.rundowns,
	async function (
		playlistIds: RundownPlaylistId[] | null,
		showStyleBaseIds: ShowStyleBaseId[] | null,
		token: string | undefined
	) {
		check(playlistIds, Match.Maybe(Array))
		check(showStyleBaseIds, Match.Maybe(Array))

		if (!playlistIds && !showStyleBaseIds)
			throw new Meteor.Error(400, 'One of playlistIds and showStyleBaseIds must be provided')

		// If values were provided, they must have values
		if (playlistIds && playlistIds.length === 0) return null
		if (showStyleBaseIds && showStyleBaseIds.length === 0) return null

		const { cred, selector } = await AutoFillSelector.organizationId<DBRundown>(this.userId, {}, token)

		// Add the requested filter
		if (playlistIds) selector.playlistId = { $in: playlistIds }
		if (showStyleBaseIds) selector.showStyleBaseId = { $in: showStyleBaseIds }

		const modifier: FindOptions<DBRundown> = {
			fields: {
				metaData: 0,
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
	async function (rundownIds: RundownId[], omitHidden: boolean, token: string | undefined) {
		check(rundownIds, Array)

		if (rundownIds.length === 0) return null

		const selector: MongoQuery<DBSegment> = {
			rundownId: { $in: rundownIds },
		}
		if (omitHidden) selector.isHidden = { $ne: true }

		if (
			NoSecurityReadAccess.any() ||
			(await RundownReadAccess.rundownContent(selector.rundownId, { userId: this.userId, token }))
		) {
			return Segments.findWithCursor(selector, {
				fields: {
					metaData: 0,
				},
			})
		}
		return null
	}
)

meteorPublish(CorelibPubSub.parts, async function (rundownIds: RundownId[], token: string | undefined) {
	check(rundownIds, Array)

	if (rundownIds.length === 0) return null

	const modifier: FindOptions<DBPart> = {
		fields: {
			metaData: 0,
		},
	}

	const selector: MongoQuery<DBPart> = {
		rundownId: { $in: rundownIds },
		reset: { $ne: true },
	}

	if (
		NoSecurityReadAccess.any() ||
		(selector.rundownId &&
			(await RundownReadAccess.rundownContent(selector.rundownId, { userId: this.userId, token }))) // ||
		// (selector._id && await RundownReadAccess.pieces(selector._id, { userId: this.userId, token })) // TODO - the types for this did not match
	) {
		return Parts.findWithCursor(selector, modifier)
	}
	return null
})
meteorPublish(
	CorelibPubSub.partInstances,
	async function (
		rundownIds: RundownId[],
		playlistActivationId: RundownPlaylistActivationId | undefined,
		token: string | undefined
	) {
		check(rundownIds, Array)
		check(playlistActivationId, Match.Maybe(String))

		if (rundownIds.length === 0 || !playlistActivationId) return null

		const modifier: FindOptions<DBPartInstance> = {
			fields: {
				// @ts-expect-error Mongo typings aren't clever enough yet
				'part.metaData': 0,
			},
		}

		const selector: MongoQuery<DBPartInstance> = {
			rundownId: { $in: rundownIds },
			playlistActivationId: playlistActivationId,
			reset: { $ne: true },
		}

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
					'part.metaData': 0,
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
						'part.metaData': 0,
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
	metaData: 0,
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
	metaData: 0,
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

meteorPublish(
	CorelibPubSub.pieceInstances,
	async function (selector: MongoQuery<PieceInstance>, token: string | undefined) {
		if (!selector) throw new Meteor.Error(400, 'selector argument missing')
		const modifier: FindOptions<PieceInstance> = {
			fields: {
				// @ts-expect-error Mongo typings aren't clever enough yet
				'piece.metaData': 0,
				'piece.timelineObjectsString': 0,
			},
		}

		// Enforce only not-reset
		selector.reset = { $ne: true }

		if (
			NoSecurityReadAccess.any() ||
			(await RundownReadAccess.rundownContent(selector.rundownId, { userId: this.userId, token }))
		) {
			return PieceInstances.findWithCursor(selector, modifier)
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
					// @ts-expect-error Mongo typings aren't clever enough yet
					'piece.metaData': 0,
					'piece.timelineObjectsString': 0,
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
				},
			})
		}
		return null
	}
)
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
		return AdLibActions.findWithCursor(selector)
	}
	return null
})
meteorPublish(MeteorPubSub.adLibActionsForPart, async function (partId: PartId, sourceLayerIds: string[]) {
	if (!partId) throw new Meteor.Error(400, 'partId argument missing')
	if (!sourceLayerIds) throw new Meteor.Error(400, 'sourceLayerIds argument missing')

	// Future: This needs some thought for a security enabled environment
	if (!NoSecurityReadAccess.any()) return null

	return AdLibActions.findWithCursor({
		partId,
		'display.sourceLayerId': { $in: sourceLayerIds },
	})
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
			return RundownBaselineAdLibActions.findWithCursor(selector)
		}
		return null
	}
)

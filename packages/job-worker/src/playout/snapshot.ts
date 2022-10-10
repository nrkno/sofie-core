import { ExpectedPackageDBType, getExpectedPackageId } from '@sofie-automation/corelib/dist/dataModel/ExpectedPackages'
import {
	AdLibActionId,
	PartId,
	PartInstanceId,
	PieceId,
	RundownBaselineAdLibActionId,
	RundownId,
	SegmentId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	SnapshotId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	GeneratePlaylistSnapshotProps,
	GeneratePlaylistSnapshotResult,
	RestorePlaylistSnapshotProps,
	RestorePlaylistSnapshotResult,
} from '@sofie-automation/corelib/dist/worker/studio'
import { getCurrentTime, getSystemVersion } from '../lib'
import _ = require('underscore')
import { JobContext } from '../jobs'
import { runWithPlaylistLock } from './lock'
import { CoreRundownPlaylistSnapshot } from '@sofie-automation/corelib/dist/snapshots'
import { unprotectString, ProtectedString, protectStringArray } from '@sofie-automation/corelib/dist/protectedString'
import { saveIntoDb } from '../db/changes'
import { getPartId, getSegmentId } from '../ingest/lib'
import { assertNever, getRandomId, literal } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../logging'
import { JSONBlobParse, JSONBlobStringify } from '@sofie-automation/shared-lib/dist/lib/JSONBlob'

export async function handleGeneratePlaylistSnapshot(
	context: JobContext,
	props: GeneratePlaylistSnapshotProps
): Promise<GeneratePlaylistSnapshotResult> {
	const snapshot = await runWithPlaylistLock(context, props.playlistId, async () => {
		const snapshotId: SnapshotId = getRandomId()
		logger.info(`Generating RundownPlaylist snapshot "${snapshotId}" for RundownPlaylist "${props.playlistId}"`)

		const playlist = await context.directCollections.RundownPlaylists.findOne(props.playlistId)
		if (!playlist) throw new Error(`Playlist "${props.playlistId}" not found`)

		const rundowns = await context.directCollections.Rundowns.findFetch({ playlistId: playlist._id })
		const rundownIds = rundowns.map((i) => i._id)
		const ingestData = await context.directCollections.IngestDataCache.findFetch(
			{ rundownId: { $in: rundownIds } },
			{ sort: { modified: -1 } }
		) // @todo: check sorting order
		// const userActions = await context.directCollections.UserActionsLog.findFetch({
		// 	args: {
		// 		$regex:
		// 			`.*(` +
		// 			rundownIds
		// 				.concat(playlistId as any)
		// 				.map((i) => `"${i}"`)
		// 				.join('|') +
		// 			`).*`,
		// 	},
		// })

		const segments = await context.directCollections.Segments.findFetch({ rundownId: { $in: rundownIds } })
		const parts = await context.directCollections.Parts.findFetch({ rundownId: { $in: rundownIds } })
		const validTime = getCurrentTime() - 1000 * 3600 * 24 // 24 hours ago
		const partInstances = await context.directCollections.PartInstances.findFetch(
			props.full
				? { rundownId: { $in: rundownIds } }
				: {
						rundownId: { $in: rundownIds },
						$or: [
							{ 'timings.plannedStoppedPlayback': { $gte: validTime }, reset: true },
							{ reset: { $ne: true } },
						],
				  }
		)
		const pieces = await context.directCollections.Pieces.findFetch({ startRundownId: { $in: rundownIds } })
		const pieceInstances = await context.directCollections.PieceInstances.findFetch(
			props.full
				? { rundownId: { $in: rundownIds } }
				: {
						rundownId: { $in: rundownIds },
						$or: [{ partInstanceId: { $in: partInstances.map((p) => p._id) } }, { reset: { $ne: true } }],
				  }
		)
		const adLibPieces = await context.directCollections.AdLibPieces.findFetch({ rundownId: { $in: rundownIds } })
		const baselineAdlibs = await context.directCollections.RundownBaselineAdLibPieces.findFetch({
			rundownId: { $in: rundownIds },
		})
		const adLibActions = await context.directCollections.AdLibActions.findFetch({ rundownId: { $in: rundownIds } })
		const baselineAdLibActions = await context.directCollections.RundownBaselineAdLibActions.findFetch({
			rundownId: { $in: rundownIds },
		})

		const expectedMediaItems = await context.directCollections.ExpectedMediaItems.findFetch({
			partId: { $in: parts.map((i) => i._id) },
		})
		const expectedPlayoutItems = await context.directCollections.ExpectedPlayoutItems.findFetch({
			rundownId: { $in: rundownIds },
		})
		const expectedPackages = await context.directCollections.ExpectedPackages.findFetch({
			rundownId: { $in: rundownIds },
		})
		const baselineObjs = await context.directCollections.RundownBaselineObjects.findFetch({
			rundownId: { $in: rundownIds },
		})

		logger.info(`Snapshot generation done`)
		return literal<CoreRundownPlaylistSnapshot>({
			version: getSystemVersion(),
			playlistId: playlist._id,
			playlist,
			rundowns,
			ingestData,
			baselineObjs,
			baselineAdlibs,
			segments,
			parts,
			partInstances,
			pieces,
			pieceInstances,
			adLibPieces,
			adLibActions,
			baselineAdLibActions,
			expectedMediaItems,
			expectedPlayoutItems,
			expectedPackages,
		})
	})

	return {
		snapshotJson: JSONBlobStringify(snapshot),
	}
}

export async function handleRestorePlaylistSnapshot(
	context: JobContext,
	props: RestorePlaylistSnapshotProps
): Promise<RestorePlaylistSnapshotResult> {
	// Future: we should validate this against a schema or something
	const snapshot: CoreRundownPlaylistSnapshot = JSONBlobParse(props.snapshotJson)

	const oldPlaylistId = snapshot.playlistId

	if (oldPlaylistId !== snapshot.playlist._id)
		throw new Error(`Restore snapshot: playlistIds don't match, "${oldPlaylistId}", "${snapshot.playlist._id}!"`)

	const playlistId = (snapshot.playlist._id = getRandomId())
	snapshot.playlist.restoredFromSnapshotId = snapshot.playlistId
	delete snapshot.playlist.activationId

	for (const rd of snapshot.rundowns) {
		if (!rd.orphaned) {
			rd.orphaned = 'from-snapshot'
		}

		rd.playlistId = playlistId
		rd.restoredFromSnapshotId = rd._id
		delete rd.peripheralDeviceId
		rd.studioId = snapshot.playlist.studioId
		rd.notifiedCurrentPlayingPartExternalId = undefined
	}

	// TODO: This is too naive. Ideally we should unset it if it isnt valid, as anything other than a match is likely to have issues.
	// Perhaps we can ask the blueprints what it should be, and hope it chooses something compatible?
	const showStyleBases = await context.getShowStyleBases()
	const showStyleVariantsCache = new Map<ShowStyleBaseId, ShowStyleVariantId[]>()
	async function getVariantIds(baseId: ShowStyleBaseId) {
		const cached = showStyleVariantsCache.get(baseId)
		if (cached) return cached

		const variants = await context.getShowStyleVariants(baseId)
		const ids = variants.map((v) => v._id)
		showStyleVariantsCache.set(baseId, ids)
		return ids
	}

	const showStyleBaseIds = showStyleBases.map((s) => s._id)
	for (const rd of snapshot.rundowns) {
		// Note: this whole loop assumes there is reasonable data in the db. If it encounters an empty array, it will get grumpy but should be predictable
		if (!showStyleBaseIds.includes(rd.showStyleBaseId)) {
			rd.showStyleBaseId = showStyleBaseIds[0]
		}

		const variantIds = await getVariantIds(rd.showStyleBaseId)
		if (variantIds && !variantIds.includes(rd.showStyleVariantId)) {
			rd.showStyleVariantId = variantIds[0]
		}
	}

	// Migrate old data:
	// 1.12.0 Release 24:
	const partSegmentIds: { [partId: string]: SegmentId } = {}
	for (const part of snapshot.parts) {
		partSegmentIds[unprotectString(part._id)] = part.segmentId
	}
	for (const piece of snapshot.pieces) {
		const pieceOld = piece as any
		if (pieceOld.rundownId) {
			piece.startRundownId = pieceOld.rundownId
			delete pieceOld.rundownId
		}
		if (pieceOld.partId) {
			piece.startPartId = pieceOld.partId
			delete pieceOld.partId
			piece.startSegmentId = partSegmentIds[unprotectString(piece.startPartId)]
		}
	}

	// List any ids that need updating on other documents
	const rundownIdMap = new Map<RundownId, RundownId>()
	const getNewRundownId = (oldRundownId: RundownId) => {
		const rundownId = rundownIdMap.get(oldRundownId)
		if (!rundownId) {
			throw new Error(`Could not find new rundownId for "${oldRundownId}"`)
		}
		return rundownId
	}
	for (const rd of snapshot.rundowns) {
		const oldId = rd._id
		rd._id = getRandomId()
		rundownIdMap.set(oldId, rd._id)
	}
	const partIdMap = new Map<PartId, PartId>()
	for (const part of snapshot.parts) {
		const oldId = part._id
		part._id = part.externalId ? getPartId(getNewRundownId(part.rundownId), part.externalId) : getRandomId()

		partIdMap.set(oldId, part._id)
	}
	const partInstanceIdMap = new Map<PartInstanceId, PartInstanceId>()
	for (const partInstance of snapshot.partInstances) {
		const oldId = partInstance._id
		partInstance._id = getRandomId()
		partInstanceIdMap.set(oldId, partInstance._id)
		partInstance.part._id = partIdMap.get(partInstance.part._id) || getRandomId()
	}
	const segmentIdMap = new Map<SegmentId, SegmentId>()
	for (const segment of snapshot.segments) {
		const oldId = segment._id
		segment._id = getSegmentId(getNewRundownId(segment.rundownId), segment.externalId)
		segmentIdMap.set(oldId, segment._id)
	}
	type AnyPieceId = PieceId | AdLibActionId | RundownBaselineAdLibActionId
	const pieceIdMap = new Map<AnyPieceId, AnyPieceId>()
	for (const piece of snapshot.pieces) {
		const oldId = piece._id
		piece.startRundownId = getNewRundownId(piece.startRundownId)
		piece.startPartId =
			partIdMap.get(piece.startPartId) ||
			getRandomIdAndWarn(`piece.startPartId=${piece.startPartId} of piece=${piece._id}`)
		piece.startSegmentId =
			segmentIdMap.get(piece.startSegmentId) ||
			getRandomIdAndWarn(`piece.startSegmentId=${piece.startSegmentId} of piece=${piece._id}`)
		piece._id = getRandomId()
		pieceIdMap.set(oldId, piece._id)
	}
	for (const adlib of [
		...snapshot.adLibPieces,
		...snapshot.adLibActions,
		...snapshot.baselineAdlibs,
		...snapshot.baselineAdLibActions,
	]) {
		const oldId = adlib._id
		if (adlib.partId) adlib.partId = partIdMap.get(adlib.partId)
		adlib._id = getRandomId()
		pieceIdMap.set(oldId, adlib._id)
	}

	for (const pieceInstance of snapshot.pieceInstances) {
		pieceInstance._id = getRandomId()

		pieceInstance.piece._id = (pieceIdMap.get(pieceInstance.piece._id) || getRandomId()) as PieceId // Note: don't warn if not found, as the piece may have been deleted
		if (pieceInstance.infinite) {
			pieceInstance.infinite.infinitePieceId =
				pieceIdMap.get(pieceInstance.infinite.infinitePieceId) || getRandomId() // Note: don't warn if not found, as the piece may have been deleted
		}
	}

	if (snapshot.playlist.currentPartInstanceId) {
		snapshot.playlist.currentPartInstanceId =
			partInstanceIdMap.get(snapshot.playlist.currentPartInstanceId) || snapshot.playlist.currentPartInstanceId
	}
	if (snapshot.playlist.nextPartInstanceId) {
		snapshot.playlist.nextPartInstanceId =
			partInstanceIdMap.get(snapshot.playlist.nextPartInstanceId) || snapshot.playlist.nextPartInstanceId
	}
	if (snapshot.playlist.previousPartInstanceId) {
		snapshot.playlist.previousPartInstanceId =
			partInstanceIdMap.get(snapshot.playlist.previousPartInstanceId) || snapshot.playlist.previousPartInstanceId
	}

	for (const expectedPackage of snapshot.expectedPackages) {
		switch (expectedPackage.fromPieceType) {
			case ExpectedPackageDBType.PIECE:
			case ExpectedPackageDBType.ADLIB_PIECE:
			case ExpectedPackageDBType.ADLIB_ACTION:
			case ExpectedPackageDBType.BASELINE_ADLIB_PIECE:
			case ExpectedPackageDBType.BASELINE_ADLIB_ACTION: {
				expectedPackage.pieceId =
					pieceIdMap.get(expectedPackage.pieceId) ||
					getRandomIdAndWarn(`expectedPackage.pieceId=${expectedPackage.pieceId}`)
				expectedPackage._id = getExpectedPackageId(expectedPackage.pieceId, expectedPackage.blueprintPackageId)

				break
			}
			case ExpectedPackageDBType.RUNDOWN_BASELINE_OBJECTS: {
				expectedPackage._id = getExpectedPackageId(
					expectedPackage.rundownId,
					expectedPackage.blueprintPackageId
				)
				break
			}
			case ExpectedPackageDBType.BUCKET_ADLIB:
			case ExpectedPackageDBType.BUCKET_ADLIB_ACTION:
			case ExpectedPackageDBType.STUDIO_BASELINE_OBJECTS: {
				// ignore, these are not present in the rundown snapshot anyway.
				logger.warn(`Unexpected ExpectedPackage in snapshot: ${JSON.stringify(expectedPackage)}`)
				break
			}

			default:
				assertNever(expectedPackage)
				break
		}
	}

	const rundownIds = snapshot.rundowns.map((r) => r._id)

	// Apply the updates of any properties to any document
	function updateItemIds<
		T extends {
			_id: ProtectedString<any>
			rundownId?: RundownId
			partInstanceId?: PartInstanceId
			partId?: PartId
			segmentId?: SegmentId
			part?: unknown
			piece?: unknown
		}
	>(objs: undefined | T[], updateId: boolean): T[] {
		const updateIds = (obj: T) => {
			if (obj.rundownId) {
				obj.rundownId = getNewRundownId(obj.rundownId)
			}

			if (obj.partId) {
				obj.partId = partIdMap.get(obj.partId) || getRandomId()
			}
			if (obj.segmentId) {
				obj.segmentId = segmentIdMap.get(obj.segmentId) || getRandomId()
			}
			if (obj.partInstanceId) {
				obj.partInstanceId = partInstanceIdMap.get(obj.partInstanceId) || getRandomId()
			}

			if (updateId) {
				obj._id = getRandomId()
			}

			if (obj.part) {
				updateIds(obj.part as any)
			}
			if (obj.piece) {
				updateIds(obj.piece as any)
			}

			return obj
		}
		return (objs || []).map((obj) => updateIds(obj))
	}

	await Promise.all([
		saveIntoDb(context, context.directCollections.RundownPlaylists, { _id: playlistId }, [snapshot.playlist]),
		saveIntoDb(context, context.directCollections.Rundowns, { playlistId }, snapshot.rundowns),
		saveIntoDb(
			context,
			context.directCollections.IngestDataCache,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.ingestData, true)
		),
		saveIntoDb(
			context,
			context.directCollections.RundownBaselineObjects,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.baselineObjs, true)
		),
		saveIntoDb(
			context,
			context.directCollections.RundownBaselineAdLibPieces,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.baselineAdlibs, true)
		),
		saveIntoDb(
			context,
			context.directCollections.RundownBaselineAdLibActions,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.baselineAdLibActions, true)
		),
		saveIntoDb(
			context,
			context.directCollections.Segments,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.segments, false)
		),
		saveIntoDb(
			context,
			context.directCollections.Parts,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.parts, false)
		),
		saveIntoDb(
			context,
			context.directCollections.PartInstances,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.partInstances, false)
		),
		saveIntoDb(
			context,
			context.directCollections.Pieces,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.pieces, false)
		),
		saveIntoDb(
			context,
			context.directCollections.PieceInstances,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.pieceInstances, false)
		),
		saveIntoDb(
			context,
			context.directCollections.AdLibPieces,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.adLibPieces, true)
		),
		saveIntoDb(
			context,
			context.directCollections.AdLibActions,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.adLibActions, true)
		),
		saveIntoDb(
			context,
			context.directCollections.ExpectedMediaItems,
			{ partId: { $in: protectStringArray(_.keys(partIdMap)) } },
			updateItemIds(snapshot.expectedMediaItems, true)
		),
		saveIntoDb(
			context,
			context.directCollections.ExpectedPlayoutItems,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.expectedPlayoutItems || [], false)
		),
		saveIntoDb(
			context,
			context.directCollections.ExpectedPackages,
			{ rundownId: { $in: rundownIds } },
			updateItemIds(snapshot.expectedPackages || [], false)
		),
	])

	logger.info(`Restore done`)
	return {
		playlistId: playlistId,
	}
}

function getRandomIdAndWarn<T extends ProtectedString<any>>(name: string): T {
	logger.warn(`Couldn't find "${name}" when restoring snapshot`)
	return getRandomId<T>()
}

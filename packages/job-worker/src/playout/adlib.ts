import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { BucketAdLib } from '@sofie-automation/corelib/dist/dataModel/BucketAdLibPiece'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	PieceInstance,
	PieceInstancePiece,
	rewrapPieceToInstance,
} from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownHoldState } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { assertNever, getRandomId, getRank, stringifyError } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../logging'
import { JobContext } from '../jobs'
import {
	AdlibPieceStartProps,
	StartStickyPieceOnSourceLayerProps,
	TakePieceAsAdlibNowProps,
} from '@sofie-automation/corelib/dist/worker/studio'
import {
	CacheForPlayout,
	getOrderedSegmentsAndPartsFromPlayoutCache,
	getRundownIDsFromCache,
	getSelectedPartInstancesFromCache,
} from './cache'
import { runJobWithPlayoutCache } from './lock'
import { updateTimeline } from './timeline'
import { selectNextPart, setNextPart } from './lib'
import { getCurrentTime } from '../lib'
import {
	convertAdLibToPieceInstance,
	convertPieceToAdLibPiece,
	getResolvedPieces,
	setupPieceInstanceInfiniteProperties,
} from './pieces'
import { updatePartInstanceRanksAfterAdlib } from '../rundown'
import {
	fetchPiecesThatMayBeActiveForPart,
	getPieceInstancesForPart,
	syncPlayheadInfinitesForNextPartInstance,
} from './infinites'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { PieceId, PieceInstanceId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { EmptyPieceTimelineObjectsBlob, Piece, PieceStatusCode } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { PieceLifespan, IBlueprintDirectPlayType, IBlueprintPieceType } from '@sofie-automation/blueprints-integration'
import { MongoQuery } from '../db'
import { ReadonlyDeep } from 'type-fest'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { executeActionInner } from './playout'
import { calculatePartExpectedDurationWithPreroll } from '@sofie-automation/corelib/dist/playout/timings'

export async function takePieceAsAdlibNow(context: JobContext, data: TakePieceAsAdlibNowProps): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		// 'pieceTakeNow',
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}

			if (playlist.currentPartInstanceId !== data.partInstanceId)
				throw UserError.create(UserErrorMessage.AdlibCurrentPart)
		},
		async (cache) => {
			const rundownIds = getRundownIDsFromCache(cache)

			const pieceInstanceToCopy = cache.PieceInstances.findOne(
				data.pieceInstanceIdOrPieceIdToCopy as PieceInstanceId
			)

			const pieceToCopy = pieceInstanceToCopy
				? pieceInstanceToCopy.piece
				: ((await context.directCollections.Pieces.findOne({
						_id: data.pieceInstanceIdOrPieceIdToCopy as PieceId,
						startRundownId: { $in: rundownIds },
				  })) as Piece)
			if (!pieceToCopy) {
				throw UserError.from(
					new Error(`PieceInstance or Piece "${data.pieceInstanceIdOrPieceIdToCopy}" not found!`),
					UserErrorMessage.PieceAsAdlibNotFound
				)
			}

			const partInstance = cache.PartInstances.findOne(data.partInstanceId)
			if (!partInstance) throw new Error(`PartInstance "${data.partInstanceId}" not found!`)
			const rundown = cache.Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${partInstance.rundownId}" not found!`)

			const showStyleBase = await context.getShowStyleBase(rundown.showStyleBaseId)
			if (!pieceToCopy.allowDirectPlay) {
				throw UserError.from(
					new Error(
						`PieceInstance or Piece "${data.pieceInstanceIdOrPieceIdToCopy}" cannot be direct played!`
					),
					UserErrorMessage.PieceAsAdlibNotDirectPlayable
				)
			} else {
				switch (pieceToCopy.allowDirectPlay.type) {
					case IBlueprintDirectPlayType.AdLibPiece:
						await pieceTakeNowAsAdlib(
							context,
							cache,
							showStyleBase,
							partInstance,
							pieceToCopy,
							pieceInstanceToCopy
						)
						break
					case IBlueprintDirectPlayType.AdLibAction: {
						const executeProps = pieceToCopy.allowDirectPlay
						await executeActionInner(
							context,
							cache,
							null, // TODO: should this be able to retrieve any watched packages?
							async (actionContext, _rundown, _currentPartInstance, blueprint) => {
								if (!blueprint.blueprint.executeAction)
									throw UserError.create(UserErrorMessage.ActionsNotSupported)

								logger.info(
									`Executing AdlibAction "${executeProps.actionId}": ${JSON.stringify(
										executeProps.userData
									)}`
								)

								try {
									await blueprint.blueprint.executeAction(
										actionContext,
										executeProps.actionId,
										executeProps.userData
									)
								} catch (err) {
									logger.error(`Error in showStyleBlueprint.executeAction: ${stringifyError(err)}`)
									// TODO: should we throw here?
									throw UserError.fromUnknown(err, UserErrorMessage.InternalError)
								}
							}
						)
						break
					}
					default:
						assertNever(pieceToCopy.allowDirectPlay)
						throw UserError.from(
							new Error(
								`PieceInstance or Piece "${data.pieceInstanceIdOrPieceIdToCopy}" cannot be direct played!`
							),
							UserErrorMessage.PieceAsAdlibNotDirectPlayable
						)
				}
			}
		}
	)
}
async function pieceTakeNowAsAdlib(
	context: JobContext,
	cache: CacheForPlayout,
	showStyleBase: ReadonlyDeep<DBShowStyleBase>,
	partInstance: DBPartInstance,
	pieceToCopy: PieceInstancePiece,
	pieceInstanceToCopy: PieceInstance | undefined
): Promise<void> {
	const playlist = cache.Playlist.doc
	if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)

	const newPieceInstance = convertAdLibToPieceInstance(
		context,
		playlist.activationId,
		pieceToCopy,
		partInstance,
		false
	)

	// Disable the original piece if from the same Part
	if (pieceInstanceToCopy && pieceInstanceToCopy.partInstanceId === partInstance._id) {
		// Ensure the piece being copied isnt currently live
		if (pieceInstanceToCopy.startedPlayback && pieceInstanceToCopy.startedPlayback <= getCurrentTime()) {
			const resolvedPieces = getResolvedPieces(context, cache, showStyleBase, partInstance)
			const resolvedPieceBeingCopied = resolvedPieces.find((p) => p._id === pieceInstanceToCopy._id)

			if (
				resolvedPieceBeingCopied &&
				resolvedPieceBeingCopied.resolvedDuration !== undefined &&
				(resolvedPieceBeingCopied.infinite ||
					resolvedPieceBeingCopied.resolvedStart + resolvedPieceBeingCopied.resolvedDuration >=
						getCurrentTime())
			) {
				// logger.debug(`Piece "${piece._id}" is currently live and cannot be used as an ad-lib`)
				throw UserError.from(
					new Error(
						`PieceInstance "${pieceInstanceToCopy._id}" is currently live and cannot be used as an ad-lib`
					),
					UserErrorMessage.PieceAsAdlibCurrentlyLive
				)
			}
		}

		cache.PieceInstances.update(pieceInstanceToCopy._id, {
			$set: {
				disabled: true,
				hidden: true,
			},
		})
	}

	cache.PieceInstances.insert(newPieceInstance)

	await syncPlayheadInfinitesForNextPartInstance(context, cache)

	await updateTimeline(context, cache)
}

export async function adLibPieceStart(context: JobContext, data: AdlibPieceStartProps): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		// 'rundownBaselineAdLibPieceStart',
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}

			if (!data.queue && playlist.currentPartInstanceId !== data.partInstanceId)
				throw UserError.create(UserErrorMessage.AdlibCurrentPart)
		},
		async (cache) => {
			const partInstance = cache.PartInstances.findOne(data.partInstanceId)
			if (!partInstance) throw new Error(`PartInstance "${data.partInstanceId}" not found!`)
			const rundown = cache.Rundowns.findOne(partInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${partInstance.rundownId}" not found!`)

			// Rundows that share the same showstyle variant as the current rundown, so adlibs from these rundowns are safe to play
			const safeRundownIds = cache.Rundowns.findFetch(
				{ showStyleVariantId: rundown.showStyleVariantId },
				{ fields: { _id: 1 } }
			).map((r) => r._id)

			let adLibPiece: AdLibPiece | BucketAdLib | undefined
			if (data.pieceType === 'baseline') {
				adLibPiece = await context.directCollections.RundownBaselineAdLibPieces.findOne({
					_id: data.adLibPieceId,
					rundownId: { $in: safeRundownIds },
				})
			} else if (data.pieceType === 'normal') {
				adLibPiece = await context.directCollections.AdLibPieces.findOne({
					_id: data.adLibPieceId,
					rundownId: { $in: safeRundownIds },
				})
			} else if (data.pieceType === 'bucket') {
				const bucketAdlib = await context.directCollections.BucketAdLibPieces.findOne({
					_id: data.adLibPieceId,
					studioId: context.studioId,
				})

				if (bucketAdlib && bucketAdlib.showStyleVariantId !== rundown.showStyleVariantId) {
					throw UserError.from(
						new Error(
							`Bucket AdLib "${data.adLibPieceId}" is not compatible with rundown "${rundown._id}"!`
						),
						UserErrorMessage.BucketAdlibIncompatible
					)
				}

				adLibPiece = bucketAdlib
			}

			if (!adLibPiece)
				throw UserError.from(
					new Error(`AdLib Piece "${data.adLibPieceId}" ("${data.pieceType}") not found!`),
					UserErrorMessage.AdlibNotFound
				)
			if (adLibPiece.invalid)
				throw UserError.from(
					new Error(`Cannot take invalid AdLib Piece "${data.adLibPieceId}"!`),
					UserErrorMessage.AdlibUnplayable
				)
			if (adLibPiece.floated)
				throw UserError.from(
					new Error(`Cannot take floated AdLib Piece "${data.adLibPieceId}"!`),
					UserErrorMessage.AdlibUnplayable
				)

			await innerStartOrQueueAdLibPiece(context, cache, rundown, !!data.queue, partInstance, adLibPiece)
		}
	)
}
export async function innerStartOrQueueAdLibPiece(
	context: JobContext,
	cache: CacheForPlayout,
	rundown: DBRundown,
	queue: boolean,
	currentPartInstance: DBPartInstance,
	adLibPiece: AdLibPiece | BucketAdLib
): Promise<void> {
	const playlist = cache.Playlist.doc
	if (!playlist.activationId) throw new Error('RundownPlaylist is not active')

	const span = context.startSpan('innerStartOrQueueAdLibPiece')
	if (queue || adLibPiece.toBeQueued) {
		const newPartInstance: DBPartInstance = {
			_id: getRandomId(),
			rundownId: rundown._id,
			segmentId: currentPartInstance.segmentId,
			playlistActivationId: playlist.activationId,
			segmentPlayoutId: currentPartInstance.segmentPlayoutId,
			takeCount: currentPartInstance.takeCount + 1,
			rehearsal: !!playlist.rehearsal,
			orphaned: 'adlib-part',
			part: {
				_id: getRandomId(),
				_rank: 99999, // Corrected in innerStartQueuedAdLib
				externalId: '',
				segmentId: currentPartInstance.segmentId,
				rundownId: rundown._id,
				title: adLibPiece.name,
				expectedDuration: adLibPiece.expectedDuration,
				expectedDurationWithPreroll: adLibPiece.expectedDuration, // Filled in later
			},
		}
		const newPieceInstance = convertAdLibToPieceInstance(
			context,
			playlist.activationId,
			adLibPiece,
			newPartInstance,
			queue
		)

		newPartInstance.part.expectedDurationWithPreroll = calculatePartExpectedDurationWithPreroll(
			newPartInstance.part,
			[newPieceInstance.piece]
		)

		await innerStartQueuedAdLib(context, cache, rundown, currentPartInstance, newPartInstance, [newPieceInstance])

		// syncPlayheadInfinitesForNextPartInstance is handled by setNextPart
	} else {
		const newPieceInstance = convertAdLibToPieceInstance(
			context,
			playlist.activationId,
			adLibPiece,
			currentPartInstance,
			queue
		)
		innerStartAdLibPiece(context, cache, rundown, currentPartInstance, newPieceInstance)

		await syncPlayheadInfinitesForNextPartInstance(context, cache)
	}

	await updateTimeline(context, cache)

	if (span) span.end()
}

export async function startStickyPieceOnSourceLayer(
	context: JobContext,
	data: StartStickyPieceOnSourceLayerProps
): Promise<void> {
	return runJobWithPlayoutCache(
		context,
		// 'sourceLayerStickyPieceStart',
		data,
		async (cache) => {
			const playlist = cache.Playlist.doc
			if (!playlist.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
			if (playlist.holdState === RundownHoldState.ACTIVE || playlist.holdState === RundownHoldState.PENDING) {
				throw UserError.create(UserErrorMessage.DuringHold)
			}
			if (!playlist.currentPartInstanceId) throw UserError.create(UserErrorMessage.NoCurrentPart)

			// if (!data.queue && playlist.currentPartInstanceId !== data.partInstanceId)
			// 	throw UserError.create(UserErrorMessage.AdlibCurrentPart)
		},
		async (cache) => {
			const { currentPartInstance } = getSelectedPartInstancesFromCache(cache)
			if (!currentPartInstance) throw UserError.create(UserErrorMessage.NoCurrentPart)

			const rundown = cache.Rundowns.findOne(currentPartInstance.rundownId)
			if (!rundown) throw new Error(`Rundown "${currentPartInstance.rundownId}" not found!`)

			const showStyleBase = await context.getShowStyleBase(rundown.showStyleBaseId)
			const sourceLayer = showStyleBase.sourceLayers.find((i) => i._id === data.sourceLayerId)
			if (!sourceLayer) throw new Error(`Source layer "${data.sourceLayerId}" not found!`)

			if (!sourceLayer.isSticky)
				throw UserError.from(
					new Error(`Only sticky layers can be restarted. "${data.sourceLayerId}" is not sticky.`),
					UserErrorMessage.SourceLayerNotSticky
				)

			const lastPieceInstance = await innerFindLastPieceOnLayer(
				context,
				cache,
				[sourceLayer._id],
				sourceLayer.stickyOriginalOnly || false
			)
			if (!lastPieceInstance) {
				throw UserError.create(UserErrorMessage.SourceLayerStickyNothingFound)
			}

			const lastPiece = convertPieceToAdLibPiece(context, lastPieceInstance.piece)
			await innerStartOrQueueAdLibPiece(context, cache, rundown, false, currentPartInstance, lastPiece)
		}
	)
}

export async function innerFindLastPieceOnLayer(
	context: JobContext,
	cache: CacheForPlayout,
	sourceLayerId: string[],
	originalOnly: boolean,
	customQuery?: MongoQuery<PieceInstance>
): Promise<PieceInstance | undefined> {
	const span = context.startSpan('innerFindLastPieceOnLayer')
	const rundownIds = getRundownIDsFromCache(cache)

	const query: MongoQuery<PieceInstance> = {
		...customQuery,
		playlistActivationId: cache.Playlist.doc.activationId,
		rundownId: { $in: rundownIds },
		'piece.sourceLayerId': { $in: sourceLayerId },
		startedPlayback: {
			$exists: true,
		},
	}

	if (originalOnly) {
		// Ignore adlibs if using original only
		query.dynamicallyInserted = {
			$exists: false,
		}
	}

	if (span) span.end()

	// Note: This does not want to use the cache, as we want to search as far back as we can
	// TODO - will this cause problems?
	return context.directCollections.PieceInstances.findOne(query, {
		sort: {
			startedPlayback: -1,
		},
	})
}

export async function innerFindLastScriptedPieceOnLayer(
	context: JobContext,
	cache: CacheForPlayout,
	sourceLayerId: string[],
	customQuery?: MongoQuery<Piece>
): Promise<Piece | undefined> {
	const span = context.startSpan('innerFindLastScriptedPieceOnLayer')

	const playlist = cache.Playlist.doc
	const rundownIds = getRundownIDsFromCache(cache)

	// TODO - this should throw instead of return more?

	if (!playlist.currentPartInstanceId || !playlist.activationId) {
		return
	}

	const currentPartInstance = cache.PartInstances.findOne(playlist.currentPartInstanceId)

	if (!currentPartInstance) {
		return
	}

	const query = {
		...customQuery,
		startRundownId: { $in: rundownIds },
		sourceLayerId: { $in: sourceLayerId },
	}

	const pieces: Pick<Piece, '_id' | 'startPartId' | 'enable'>[] = await context.directCollections.Pieces.findFetch(
		query,
		{
			projection: { _id: 1, startPartId: 1, enable: 1 },
		}
	)

	const part = cache.Parts.findOne(
		{ _id: { $in: pieces.map((p) => p.startPartId) }, _rank: { $lte: currentPartInstance.part._rank } },
		{ sort: { _rank: -1 } }
	)

	if (!part) {
		return
	}

	const partStarted = currentPartInstance.timings?.startedPlayback
	const nowInPart = partStarted ? getCurrentTime() - partStarted : 0

	const piece = pieces
		.filter((p) => p.startPartId === part._id && (p.enable.start === 'now' || p.enable.start <= nowInPart))
		.sort((a, b) => {
			if (a.enable.start === 'now' && b.enable.start === 'now') return 0
			if (a.enable.start === 'now') return -1
			if (b.enable.start === 'now') return 1

			return b.enable.start - a.enable.start
		})[0]

	const fullPiece = await context.directCollections.Pieces.findOne(piece._id)
	if (!fullPiece) return

	if (span) span.end()
	return fullPiece
}

export async function innerStartQueuedAdLib(
	context: JobContext,
	cache: CacheForPlayout,
	rundown: DBRundown,
	currentPartInstance: DBPartInstance,
	newPartInstance: DBPartInstance,
	newPieceInstances: PieceInstance[]
): Promise<void> {
	const span = context.startSpan('innerStartQueuedAdLib')
	logger.info('adlibQueueInsertPartInstance')

	// Ensure it is labelled as dynamic
	newPartInstance.orphaned = 'adlib-part'

	const followingPart = selectNextPart(
		context,
		cache.Playlist.doc,
		currentPartInstance,
		null,
		getOrderedSegmentsAndPartsFromPlayoutCache(cache),
		true
	)
	newPartInstance.part._rank = getRank(
		currentPartInstance.part,
		followingPart?.part?.segmentId === newPartInstance.segmentId ? followingPart?.part : undefined
	)

	cache.PartInstances.insert(newPartInstance)

	newPieceInstances.forEach((pieceInstance) => {
		// Ensure it is labelled as dynamic
		pieceInstance.dynamicallyInserted = getCurrentTime()
		pieceInstance.partInstanceId = newPartInstance._id
		pieceInstance.piece.startPartId = newPartInstance.part._id

		setupPieceInstanceInfiniteProperties(pieceInstance)

		cache.PieceInstances.insert(pieceInstance)
	})

	updatePartInstanceRanksAfterAdlib(cache, newPartInstance.part.segmentId)

	// Find and insert any rundown defined infinites that we should inherit
	newPartInstance = cache.PartInstances.findOne(newPartInstance._id) as DBPartInstance
	const possiblePieces = await fetchPiecesThatMayBeActiveForPart(context, cache, undefined, newPartInstance.part)
	const infinitePieceInstances = getPieceInstancesForPart(
		context,
		cache,
		currentPartInstance,
		rundown,
		newPartInstance.part,
		possiblePieces,
		newPartInstance._id,
		false
	)
	for (const pieceInstance of infinitePieceInstances) {
		cache.PieceInstances.insert(pieceInstance)
	}

	await setNextPart(context, cache, newPartInstance)

	if (span) span.end()
}

export function innerStartAdLibPiece(
	context: JobContext,
	cache: CacheForPlayout,
	_rundown: DBRundown,
	existingPartInstance: DBPartInstance,
	newPieceInstance: PieceInstance
): void {
	const span = context.startSpan('innerStartAdLibPiece')
	// Ensure it is labelled as dynamic
	newPieceInstance.partInstanceId = existingPartInstance._id
	newPieceInstance.piece.startPartId = existingPartInstance.part._id
	newPieceInstance.dynamicallyInserted = getCurrentTime()

	setupPieceInstanceInfiniteProperties(newPieceInstance)

	// exclusiveGroup is handled at runtime by processAndPrunePieceInstanceTimings

	cache.PieceInstances.insert(newPieceInstance)
	if (span) span.end()
}

export function innerStopPieces(
	context: JobContext,
	cache: CacheForPlayout,
	showStyleBase: ReadonlyDeep<DBShowStyleBase>,
	currentPartInstance: DBPartInstance,
	filter: (pieceInstance: PieceInstance) => boolean,
	timeOffset: number | undefined
): Array<PieceInstanceId> {
	const span = context.startSpan('innerStopPieces')
	const stoppedInstances: PieceInstanceId[] = []

	const lastStartedPlayback = currentPartInstance.timings?.startedPlayback
	if (lastStartedPlayback === undefined) {
		throw new Error('Cannot stop pieceInstances when partInstance hasnt started playback')
	}

	const resolvedPieces = getResolvedPieces(context, cache, showStyleBase, currentPartInstance)
	const stopAt = getCurrentTime() + (timeOffset || 0)
	const relativeStopAt = stopAt - lastStartedPlayback

	const stoppedInfiniteIds = new Set<PieceId>()

	for (const pieceInstance of resolvedPieces) {
		if (
			!pieceInstance.userDuration &&
			!pieceInstance.piece.virtual &&
			filter(pieceInstance) &&
			pieceInstance.resolvedStart !== undefined &&
			pieceInstance.resolvedStart <= relativeStopAt &&
			!pieceInstance.stoppedPlayback
		) {
			switch (pieceInstance.piece.lifespan) {
				case PieceLifespan.WithinPart:
				case PieceLifespan.OutOnSegmentChange:
				case PieceLifespan.OutOnRundownChange: {
					logger.info(`Blueprint action: Cropping PieceInstance "${pieceInstance._id}" to ${stopAt}`)
					const up: Partial<PieceInstance> = {
						userDuration: {
							end: relativeStopAt,
						},
					}
					if (pieceInstance.infinite) {
						stoppedInfiniteIds.add(pieceInstance.infinite.infinitePieceId)
					}

					cache.PieceInstances.update(
						{
							_id: pieceInstance._id,
						},
						{
							$set: up,
						}
					)

					stoppedInstances.push(pieceInstance._id)
					break
				}
				case PieceLifespan.OutOnSegmentEnd:
				case PieceLifespan.OutOnRundownEnd:
				case PieceLifespan.OutOnShowStyleEnd: {
					logger.info(
						`Blueprint action: Cropping PieceInstance "${pieceInstance._id}" to ${stopAt} with a virtual`
					)

					const pieceId: PieceId = getRandomId()
					cache.PieceInstances.insert({
						...rewrapPieceToInstance(
							{
								_id: pieceId,
								externalId: '-',
								enable: { start: relativeStopAt },
								lifespan: pieceInstance.piece.lifespan,
								sourceLayerId: pieceInstance.piece.sourceLayerId,
								outputLayerId: pieceInstance.piece.outputLayerId,
								invalid: false,
								name: '',
								startPartId: currentPartInstance.part._id,
								status: PieceStatusCode.UNKNOWN,
								pieceType: IBlueprintPieceType.Normal,
								virtual: true,
								content: {},
								timelineObjectsString: EmptyPieceTimelineObjectsBlob,
							},
							currentPartInstance.playlistActivationId,
							currentPartInstance.rundownId,
							currentPartInstance._id
						),
						dynamicallyInserted: getCurrentTime(),
						infinite: {
							infiniteInstanceId: getRandomId(),
							infiniteInstanceIndex: 0,
							infinitePieceId: pieceId,
							fromPreviousPart: false,
						},
					})

					stoppedInstances.push(pieceInstance._id)
					break
				}
				default:
					assertNever(pieceInstance.piece.lifespan)
			}
		}
	}

	if (span) span.end()
	return stoppedInstances
}

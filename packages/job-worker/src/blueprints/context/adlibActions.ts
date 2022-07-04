import {
	IActionExecutionContext,
	IBlueprintMutatablePart,
	IBlueprintPart,
	IBlueprintPartInstance,
	IBlueprintPiece,
	IBlueprintPieceDB,
	IBlueprintPieceInstance,
	IBlueprintResolvedPieceInstance,
	IEventContext,
	OmitId,
	SomeContent,
	Time,
	WithTimeline,
} from '@sofie-automation/blueprints-integration'
import { PartInstanceId, RundownPlaylistActivationId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleCompound'
import { UserError, UserErrorMessage } from '@sofie-automation/corelib/dist/error'
import { assertNever, getRandomId, omit } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../../logging'
import { ReadonlyDeep, SetRequired } from 'type-fest'
import { CacheForPlayout, getRundownIDsFromCache } from '../../playout/cache'
import { ShowStyleUserContext, UserContextInfo } from './context'
import { WatchedPackagesHelper } from './watchedPackages'
import { getCurrentTime } from '../../lib'
import {
	protectString,
	protectStringArray,
	unprotectString,
	unprotectStringArray,
} from '@sofie-automation/corelib/dist/protectedString'
import { getResolvedPieces, setupPieceInstanceInfiniteProperties } from '../../playout/pieces'
import { JobContext } from '../../jobs'
import { MongoQuery, MongoModifier } from '../../db'
import { PieceInstance, wrapPieceToInstance } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import {
	innerFindLastPieceOnLayer,
	innerFindLastScriptedPieceOnLayer,
	innerStartAdLibPiece,
	innerStartQueuedAdLib,
	innerStopPieces,
} from '../../playout/adlib'
import { Piece, serializePieceTimelineObjectsBlob } from '@sofie-automation/corelib/dist/dataModel/Piece'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import {
	convertPartInstanceToBlueprints,
	convertPieceInstanceToBlueprints,
	convertPieceToBlueprints,
	convertResolvedPieceInstanceToBlueprints,
	IBlueprintMutatablePartSampleKeys,
	IBlueprintPieceObjectsSampleKeys,
} from './lib'
import { postProcessPieces, postProcessTimelineObjects } from '../postProcess'
import { isTooCloseToAutonext } from '../../playout/lib'
import { isPartPlayable } from '@sofie-automation/corelib/dist/dataModel/Part'
import { moveNextPartInner } from '../../playout/playout'
import _ = require('underscore')
import { ProcessedShowStyleConfig } from '../config'

export enum ActionPartChange {
	NONE = 0,
	SAFE_CHANGE = 1,
}

/** Actions */
export class ActionExecutionContext extends ShowStyleUserContext implements IActionExecutionContext, IEventContext {
	private readonly _context: JobContext
	private readonly _cache: CacheForPlayout
	private readonly rundown: DBRundown
	private readonly playlistActivationId: RundownPlaylistActivationId

	/** To be set by any mutation methods on this context. Indicates to core how extensive the changes are to the current partInstance */
	public currentPartState: ActionPartChange = ActionPartChange.NONE
	/** To be set by any mutation methods on this context. Indicates to core how extensive the changes are to the next partInstance */
	public nextPartState: ActionPartChange = ActionPartChange.NONE
	public takeAfterExecute: boolean
	public queuedPartInstanceId: PartInstanceId | undefined = undefined

	constructor(
		contextInfo: UserContextInfo,
		context: JobContext,
		cache: CacheForPlayout,
		showStyle: ReadonlyDeep<ShowStyleCompound>,
		showStyleBlueprintConfig: ProcessedShowStyleConfig,
		rundown: DBRundown,
		watchedPackages: WatchedPackagesHelper
	) {
		super(
			contextInfo,
			context.studio,
			context.getStudioBlueprintConfig(),
			showStyle,
			showStyleBlueprintConfig,
			watchedPackages
		)
		this._context = context
		this._cache = cache
		this.rundown = rundown
		this.takeAfterExecute = false

		if (!this._cache.Playlist.doc.activationId) throw UserError.create(UserErrorMessage.InactiveRundown)
		this.playlistActivationId = this._cache.Playlist.doc.activationId
	}

	private _getPartInstanceId(part: 'current' | 'next'): PartInstanceId | null {
		switch (part) {
			case 'current':
				return this._cache.Playlist.doc.currentPartInstanceId
			case 'next':
				return this._cache.Playlist.doc.nextPartInstanceId
			default:
				assertNever(part)
				logger.warn(`Blueprint action requested unknown PartInstance "${part}"`)
				throw new Error(`Unknown part "${part}"`)
		}
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}

	async getPartInstance(part: 'current' | 'next'): Promise<IBlueprintPartInstance | undefined> {
		const partInstanceId = this._getPartInstanceId(part)
		if (!partInstanceId) {
			return undefined
		}

		const partInstance = this._cache.PartInstances.findOne(partInstanceId)
		return partInstance && convertPartInstanceToBlueprints(partInstance)
	}
	async getPieceInstances(part: 'current' | 'next'): Promise<IBlueprintPieceInstance[]> {
		const partInstanceId = this._getPartInstanceId(part)
		if (!partInstanceId) {
			return []
		}

		const pieceInstances = this._cache.PieceInstances.findFetch({ partInstanceId })
		return pieceInstances.map(convertPieceInstanceToBlueprints)
	}
	async getResolvedPieceInstances(part: 'current' | 'next'): Promise<IBlueprintResolvedPieceInstance[]> {
		const partInstanceId = this._getPartInstanceId(part)
		if (!partInstanceId) {
			return []
		}

		const partInstance = this._cache.PartInstances.findOne(partInstanceId)
		if (!partInstance) {
			return []
		}

		const resolvedInstances = getResolvedPieces(this._context, this._cache, this.showStyleCompound, partInstance)
		return resolvedInstances.map(convertResolvedPieceInstanceToBlueprints)
	}

	async findLastPieceOnLayer(
		sourceLayerId0: string | string[],
		options?: {
			excludeCurrentPart?: boolean
			originalOnly?: boolean
			pieceMetaDataFilter?: any
		}
	): Promise<IBlueprintPieceInstance | undefined> {
		const query: MongoQuery<PieceInstance> = {}
		if (options && options.pieceMetaDataFilter) {
			for (const [key, value] of Object.entries(options.pieceMetaDataFilter)) {
				// TODO do we need better validation here?
				// It should be pretty safe as we are working with the cache version (for now)
				// @ts-expect-error metaData is `unknown` so no subkeys are known to be valid
				query[`piece.metaData.${key}`] = value
			}
		}

		if (options && options.excludeCurrentPart && this._cache.Playlist.doc.currentPartInstanceId) {
			query['partInstanceId'] = { $ne: this._cache.Playlist.doc.currentPartInstanceId }
		}

		const sourceLayerId = Array.isArray(sourceLayerId0) ? sourceLayerId0 : [sourceLayerId0]

		const lastPieceInstance = await innerFindLastPieceOnLayer(
			this._context,
			this._cache,
			sourceLayerId,
			(options && options.originalOnly) || false,
			query
		)

		return lastPieceInstance && convertPieceInstanceToBlueprints(lastPieceInstance)
	}

	async findLastScriptedPieceOnLayer(
		sourceLayerId0: string | string[],
		options?: {
			excludeCurrentPart?: boolean
			pieceMetaDataFilter?: any
		}
	): Promise<IBlueprintPieceDB | undefined> {
		const query: MongoQuery<Piece> = {}
		if (options && options.pieceMetaDataFilter) {
			for (const [key, value] of Object.entries(options.pieceMetaDataFilter)) {
				// TODO do we need better validation here?
				// It should be pretty safe as we are working with the cache version (for now)
				// @ts-expect-error metaData is `unknown` so no subkeys are known to be valid
				query[`metaData.${key}`] = value
			}
		}

		if (options && options.excludeCurrentPart && this._cache.Playlist.doc.currentPartInstanceId) {
			const currentPartInstance = this._cache.PartInstances.findOne(
				this._cache.Playlist.doc.currentPartInstanceId
			)

			if (currentPartInstance) {
				query['startPartId'] = { $ne: currentPartInstance.part._id }
			}
		}

		const sourceLayerId = Array.isArray(sourceLayerId0) ? sourceLayerId0 : [sourceLayerId0]

		const lastPiece = await innerFindLastScriptedPieceOnLayer(this._context, this._cache, sourceLayerId, query)

		return lastPiece && convertPieceToBlueprints(lastPiece)
	}

	async getPartInstanceForPreviousPiece(piece: IBlueprintPieceInstance): Promise<IBlueprintPartInstance> {
		const pieceExt = piece as unknown as Partial<PieceInstance> | undefined
		const partInstanceId = pieceExt?.partInstanceId
		if (!partInstanceId) {
			throw new Error('Cannot find PartInstance from invalid PieceInstance')
		}

		const cached = this._cache.PartInstances.findOne(partInstanceId)
		if (cached) {
			return convertPartInstanceToBlueprints(cached)
		}

		// It might be reset and so not in the cache
		const rundownIds = getRundownIDsFromCache(this._cache)
		const oldInstance = await this._context.directCollections.PartInstances.findOne({
			_id: partInstanceId,
			rundownId: { $in: rundownIds },
		})
		if (oldInstance) {
			return convertPartInstanceToBlueprints(oldInstance)
		} else {
			throw new Error('Cannot find PartInstance for PieceInstance')
		}
	}

	async getPartForPreviousPiece(piece: Partial<Pick<IBlueprintPieceDB, '_id'>>): Promise<IBlueprintPart | undefined> {
		if (!piece?._id) {
			throw new Error('Cannot find Part from invalid Piece')
		}

		const pieceDB = await this._context.directCollections.Pieces.findOne({
			_id: protectString(piece._id),
			startRundownId: { $in: getRundownIDsFromCache(this._cache) },
		})
		if (!pieceDB) throw new Error(`Cannot find Piece ${piece._id}`)

		return this._cache.Parts.findOne({ _id: pieceDB.startPartId })
	}

	async insertPiece(part: 'current' | 'next', rawPiece: IBlueprintPiece): Promise<IBlueprintPieceInstance> {
		const partInstanceId = this._getPartInstanceId(part)
		if (!partInstanceId) {
			throw new Error('Cannot insert piece when no active part')
		}

		const partInstance = this._cache.PartInstances.findOne(partInstanceId)
		if (!partInstance) {
			throw new Error('Cannot queue part when no partInstance')
		}

		const rundown = this._cache.Rundowns.findOne(partInstance.rundownId)
		if (!rundown) {
			throw new Error('Failed to find rundown of partInstance')
		}

		const trimmedPiece: IBlueprintPiece = _.pick(rawPiece, IBlueprintPieceObjectsSampleKeys)

		const piece = postProcessPieces(
			this._context,
			[trimmedPiece],
			this.showStyleCompound.blueprintId,
			partInstance.rundownId,
			partInstance.segmentId,
			partInstance.part._id,
			part === 'current'
		)[0]
		piece._id = getRandomId() // Make id random, as postProcessPieces is too predictable (for ingest)
		const newPieceInstance = wrapPieceToInstance(piece, this.playlistActivationId, partInstance._id)

		// Do the work
		innerStartAdLibPiece(this._context, this._cache, rundown, partInstance, newPieceInstance)

		if (part === 'current') {
			this.currentPartState = Math.max(this.currentPartState, ActionPartChange.SAFE_CHANGE)
		} else {
			this.nextPartState = Math.max(this.nextPartState, ActionPartChange.SAFE_CHANGE)
		}

		return convertPieceInstanceToBlueprints(newPieceInstance)
	}
	async updatePieceInstance(
		pieceInstanceId: string,
		piece: Partial<OmitId<IBlueprintPiece>>
	): Promise<IBlueprintPieceInstance> {
		// filter the submission to the allowed ones
		const trimmedPiece: Partial<OmitId<IBlueprintPiece>> = _.pick(piece, IBlueprintPieceObjectsSampleKeys)
		if (Object.keys(trimmedPiece).length === 0) {
			throw new Error('Some valid properties must be defined')
		}

		const pieceInstance = this._cache.PieceInstances.findOne(protectString(pieceInstanceId))
		if (!pieceInstance) {
			throw new Error('PieceInstance could not be found')
		}

		if (pieceInstance.infinite?.fromPreviousPart) {
			throw new Error('Cannot update an infinite piece that is continued from a previous part')
		}

		const updatesCurrentPart: ActionPartChange =
			pieceInstance.partInstanceId === this._cache.Playlist.doc.currentPartInstanceId
				? ActionPartChange.SAFE_CHANGE
				: ActionPartChange.NONE
		const updatesNextPart: ActionPartChange =
			pieceInstance.partInstanceId === this._cache.Playlist.doc.nextPartInstanceId
				? ActionPartChange.SAFE_CHANGE
				: ActionPartChange.NONE
		if (!updatesCurrentPart && !updatesNextPart) {
			throw new Error('Can only update piece instances in current or next part instance')
		}

		const update: SetRequired<MongoModifier<PieceInstance>, '$set' | '$unset'> = {
			$set: {},
			$unset: {},
		}

		if (trimmedPiece.content?.timelineObjects) {
			update.$set['piece.timelineObjectsString'] = serializePieceTimelineObjectsBlob(
				postProcessTimelineObjects(
					pieceInstance.piece._id,
					this.showStyleCompound.blueprintId,
					trimmedPiece.content.timelineObjects
				)
			)
			// This has been processed
			trimmedPiece.content = omit(trimmedPiece.content, 'timelineObjects') as WithTimeline<SomeContent>
		}

		for (const [k, val] of Object.entries(trimmedPiece)) {
			if (val === undefined) {
				update.$unset[`piece.${k}`] = 1
			} else {
				update.$set[`piece.${k}`] = val
			}
		}

		setupPieceInstanceInfiniteProperties(pieceInstance)

		this._cache.PieceInstances.update(pieceInstance._id, update)

		this.nextPartState = Math.max(this.nextPartState, updatesNextPart)
		this.currentPartState = Math.max(this.currentPartState, updatesCurrentPart)

		const updatedPieceInstance = this._cache.PieceInstances.findOne(pieceInstance._id)
		if (!updatedPieceInstance) throw new Error('PieceInstance disappeared!')

		return convertPieceInstanceToBlueprints(updatedPieceInstance)
	}
	async queuePart(rawPart: IBlueprintPart, rawPieces: IBlueprintPiece[]): Promise<IBlueprintPartInstance> {
		const currentPartInstance = this._cache.Playlist.doc.currentPartInstanceId
			? this._cache.PartInstances.findOne(this._cache.Playlist.doc.currentPartInstanceId)
			: undefined
		if (!currentPartInstance) {
			throw new Error('Cannot queue part when no current partInstance')
		}

		if (this.nextPartState !== ActionPartChange.NONE) {
			// Ensure we dont insert a piece into a part before replacing it with a queued part, as this will cause some data integrity issues
			// This could be changed if we have a way to abort the pending changes in the nextPart.
			// TODO-PartInstances - perhaps this could be dropped as only the instance will have changed, and that will be trashed by the setAsNext?
			throw new Error('Cannot queue part when next part has already been modified')
		}

		if (isTooCloseToAutonext(currentPartInstance, true)) {
			throw new Error('Too close to an autonext to queue a part')
		}

		if (rawPieces.length === 0) {
			throw new Error('New part must contain at least one piece')
		}

		const newPartInstance: DBPartInstance = {
			_id: getRandomId(),
			rundownId: currentPartInstance.rundownId,
			segmentId: currentPartInstance.segmentId,
			playlistActivationId: this.playlistActivationId,
			segmentPlayoutId: currentPartInstance.segmentPlayoutId,
			takeCount: currentPartInstance.takeCount + 1,
			rehearsal: currentPartInstance.rehearsal,
			part: {
				...rawPart,
				_id: getRandomId(),
				rundownId: currentPartInstance.rundownId,
				segmentId: currentPartInstance.segmentId,
				_rank: 99999, // Corrected in innerStartQueuedAdLib
				notes: [],
				invalid: false,
				invalidReason: undefined,
				floated: false,
				expectedDurationWithPreroll: undefined, // Filled in later
			},
		}

		if (!isPartPlayable(newPartInstance.part)) {
			throw new Error('Cannot queue a part which is not playable')
		}

		const pieces = postProcessPieces(
			this._context,
			rawPieces,
			this.showStyleCompound.blueprintId,
			currentPartInstance.rundownId,
			newPartInstance.segmentId,
			newPartInstance.part._id,
			false
		)
		const newPieceInstances = pieces.map((piece) =>
			wrapPieceToInstance(piece, this.playlistActivationId, newPartInstance._id)
		)

		// Do the work
		await innerStartQueuedAdLib(
			this._context,
			this._cache,
			this.rundown,
			currentPartInstance,
			newPartInstance,
			newPieceInstances
		)

		this.nextPartState = ActionPartChange.SAFE_CHANGE
		this.queuedPartInstanceId = newPartInstance._id

		return convertPartInstanceToBlueprints(newPartInstance)
	}
	async moveNextPart(partDelta: number, segmentDelta: number): Promise<void> {
		await moveNextPartInner(this._context, this._cache, partDelta, segmentDelta)
	}
	async updatePartInstance(
		part: 'current' | 'next',
		props: Partial<IBlueprintMutatablePart>
	): Promise<IBlueprintPartInstance> {
		// filter the submission to the allowed ones
		const trimmedProps: Partial<IBlueprintMutatablePart> = _.pick(props, IBlueprintMutatablePartSampleKeys)
		if (Object.keys(trimmedProps).length === 0) {
			throw new Error('Some valid properties must be defined')
		}

		const partInstanceId = this._getPartInstanceId(part)
		if (!partInstanceId) {
			throw new Error('PartInstance could not be found')
		}

		const partInstance = this._cache.PartInstances.findOne(partInstanceId)
		if (!partInstance) {
			throw new Error('PartInstance could not be found')
		}

		const update: any = {
			$set: {},
			$unset: {},
		}

		for (const [k, val] of Object.entries(trimmedProps)) {
			if (val === undefined) {
				update.$unset[`part.${k}`] = val
			} else {
				update.$set[`part.${k}`] = val
			}
		}

		this._cache.PartInstances.update(partInstance._id, update)

		this.nextPartState = Math.max(
			this.nextPartState,
			part === 'next' ? ActionPartChange.SAFE_CHANGE : ActionPartChange.NONE
		)
		this.currentPartState = Math.max(
			this.currentPartState,
			part === 'current' ? ActionPartChange.SAFE_CHANGE : ActionPartChange.NONE
		)

		const updatedPartInstance = this._cache.PartInstances.findOne(partInstance._id)
		if (!updatedPartInstance) {
			throw new Error('PartInstance could not be found, after applying changes')
		}

		return convertPartInstanceToBlueprints(updatedPartInstance)
	}

	async stopPiecesOnLayers(sourceLayerIds: string[], timeOffset?: number | undefined): Promise<string[]> {
		if (sourceLayerIds.length == 0) {
			return []
		}

		return this._stopPiecesByRule(
			(pieceInstance) => sourceLayerIds.indexOf(pieceInstance.piece.sourceLayerId) !== -1,
			timeOffset
		)
	}
	async stopPieceInstances(pieceInstanceIds: string[], timeOffset?: number | undefined): Promise<string[]> {
		if (pieceInstanceIds.length == 0) {
			return []
		}

		return this._stopPiecesByRule(
			(pieceInstance) => pieceInstanceIds.indexOf(unprotectString(pieceInstance._id)) !== -1,
			timeOffset
		)
	}
	async removePieceInstances(_part: 'next', pieceInstanceIds: string[]): Promise<string[]> {
		const partInstanceId = this._cache.Playlist.doc.nextPartInstanceId // this._getPartInstanceId(part)
		if (!partInstanceId) {
			throw new Error('Cannot remove pieceInstances when no selected partInstance')
		}

		const pieceInstances = this._cache.PieceInstances.findFetch({
			partInstanceId: partInstanceId,
			_id: { $in: protectStringArray(pieceInstanceIds) },
		})

		this._cache.PieceInstances.remove({
			partInstanceId: partInstanceId,
			_id: { $in: pieceInstances.map((p) => p._id) },
		})

		this.nextPartState = Math.max(this.nextPartState, ActionPartChange.SAFE_CHANGE)

		return unprotectStringArray(pieceInstances.map((p) => p._id))
	}

	async takeAfterExecuteAction(take: boolean): Promise<boolean> {
		this.takeAfterExecute = take

		return this.takeAfterExecute
	}

	async blockTakeUntil(time: Time | null): Promise<void> {
		if (time !== null && (time < getCurrentTime() || typeof time !== 'number'))
			throw new Error('Cannot block taking out of the current part, to a time in the past')

		const partInstanceId = this._cache.Playlist.doc.currentPartInstanceId
		if (!partInstanceId) {
			throw new Error('Cannot block take when there is no part playing')
		}
		this._cache.PartInstances.update(partInstanceId, (doc) => {
			if (time) {
				doc.blockTakeUntil = time
			} else {
				delete doc.blockTakeUntil
			}
			return doc
		})
	}

	private _stopPiecesByRule(filter: (pieceInstance: PieceInstance) => boolean, timeOffset: number | undefined) {
		if (!this._cache.Playlist.doc.currentPartInstanceId) {
			return []
		}
		const partInstance = this._cache.PartInstances.findOne(this._cache.Playlist.doc.currentPartInstanceId)
		if (!partInstance) {
			throw new Error('Cannot stop pieceInstances when no current partInstance')
		}

		const stoppedIds = innerStopPieces(
			this._context,
			this._cache,
			this.showStyleCompound,
			partInstance,
			filter,
			timeOffset
		)

		if (stoppedIds.length > 0) {
			this.currentPartState = Math.max(this.currentPartState, ActionPartChange.SAFE_CHANGE)
		}

		return unprotectStringArray(stoppedIds)
	}

	// hackGetMediaObjectDuration(mediaId: string): number | undefined {
	// 	return MediaObjects.findOne({ mediaId: mediaId.toUpperCase(), studioId: protectString(this.studioId) })
	// 		?.mediainfo?.format?.duration
	// }
}

import * as _ from 'underscore'
import {
	unprotectString,
	unprotectObject,
	protectString,
	assertNever,
	getCurrentTime,
	unprotectStringArray,
	getRandomId,
	protectStringArray,
	waitTime,
} from '../../../../lib/lib'
import { Part } from '../../../../lib/collections/Parts'
import { logger } from '../../../../lib/logging'
import {
	EventContext as IEventContext,
	ActionExecutionContext as IActionExecutionContext,
	IBlueprintPartInstance,
	IBlueprintPieceInstance,
	IBlueprintPiece,
	IBlueprintPart,
	IBlueprintResolvedPieceInstance,
	OmitId,
	IBlueprintMutatablePart,
} from '@sofie-automation/blueprints-integration'
import { Studio } from '../../../../lib/collections/Studios'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { PieceInstance, wrapPieceToInstance } from '../../../../lib/collections/PieceInstances'
import { PartInstanceId, PartInstance } from '../../../../lib/collections/PartInstances'
import { CacheForRundownPlaylist } from '../../../DatabaseCaches'
import { getResolvedPieces, setupPieceInstanceInfiniteProperties } from '../../playout/pieces'
import { postProcessPieces, postProcessTimelineObjects } from '../postProcess'
import { NotesContext, ShowStyleContext } from './context'
import { isTooCloseToAutonext } from '../../playout/lib'
import { ServerPlayoutAdLibAPI } from '../../playout/adlib'
import { MongoQuery } from '../../../../lib/typings/meteor'
import { clone } from '../../../../lib/lib'
import { IBlueprintPieceSampleKeys, IBlueprintMutatablePartSampleKeys } from './lib'

export enum ActionPartChange {
	NONE = 0,
	SAFE_CHANGE = 1,
}

/** Actions */
export class ActionExecutionContext extends ShowStyleContext implements IActionExecutionContext, IEventContext {
	private readonly _cache: CacheForRundownPlaylist
	private readonly rundownPlaylist: RundownPlaylist
	private readonly rundown: Rundown

	/** To be set by any mutation methods on this context. Indicates to core how extensive the changes are to the current partInstance */
	public currentPartState: ActionPartChange = ActionPartChange.NONE
	/** To be set by any mutation methods on this context. Indicates to core how extensive the changes are to the next partInstance */
	public nextPartState: ActionPartChange = ActionPartChange.NONE
	public takeAfterExecute: boolean

	constructor(
		cache: CacheForRundownPlaylist,
		notesContext: NotesContext,
		studio: Studio,
		rundownPlaylist: RundownPlaylist,
		rundown: Rundown
	) {
		super(studio, cache, rundown, rundown.showStyleBaseId, rundown.showStyleVariantId, notesContext)
		this._cache = cache
		this.rundownPlaylist = rundownPlaylist
		this.rundown = rundown
		this.takeAfterExecute = false
	}

	private _getPartInstanceId(part: 'current' | 'next'): PartInstanceId | null {
		switch (part) {
			case 'current':
				return this.rundownPlaylist.currentPartInstanceId
			case 'next':
				return this.rundownPlaylist.nextPartInstanceId
			default:
				assertNever(part)
				logger.warn(`Blueprint action requested unknown PartInstance "${part}"`)
				throw new Error(`Unknown part "${part}"`)
		}
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}

	getPartInstance(part: 'current' | 'next'): IBlueprintPartInstance | undefined {
		const partInstanceId = this._getPartInstanceId(part)
		if (!partInstanceId) {
			return undefined
		}

		const partInstance = this._cache.PartInstances.findOne(partInstanceId)
		return clone(unprotectObject(partInstance))
	}
	getPieceInstances(part: 'current' | 'next'): IBlueprintPieceInstance[] {
		const partInstanceId = this._getPartInstanceId(part)
		if (!partInstanceId) {
			return []
		}

		const pieceInstances = this._cache.PieceInstances.findFetch({ partInstanceId })
		return pieceInstances.map((piece) => clone(unprotectObject(piece)))
	}
	getResolvedPieceInstances(part: 'current' | 'next'): IBlueprintResolvedPieceInstance[] {
		const partInstanceId = this._getPartInstanceId(part)
		if (!partInstanceId) {
			return []
		}

		const partInstance = this._cache.PartInstances.findOne(partInstanceId)
		if (!partInstance) {
			return []
		}

		const resolvedInstances = getResolvedPieces(this._cache, this.getShowStyleBase(), partInstance)
		return resolvedInstances.map((piece) => clone(unprotectObject(piece)))
	}

	findLastPieceOnLayer(
		sourceLayerId: string,
		options?: {
			excludeCurrentPart?: boolean
			originalOnly?: boolean
			pieceMetaDataFilter?: any
		}
	): IBlueprintPieceInstance | undefined {
		const query: MongoQuery<PieceInstance> = {}
		if (options && options.pieceMetaDataFilter) {
			for (const [key, value] of Object.entries(options.pieceMetaDataFilter)) {
				// TODO do we need better validation here?
				// It should be pretty safe as we are working with the cache version (for now)
				query[`piece.metaData.${key}`] = value
			}
		}

		if (options && options.excludeCurrentPart && this.rundownPlaylist.currentPartInstanceId) {
			query['partInstanceId'] = { $ne: this.rundownPlaylist.currentPartInstanceId }
		}

		const lastPieceInstance = ServerPlayoutAdLibAPI.innerFindLastPieceOnLayer(
			this._cache,
			this.rundownPlaylist,
			sourceLayerId,
			(options && options.originalOnly) || false,
			query
		)

		return clone(unprotectObject(lastPieceInstance))
	}
	insertPiece(part: 'current' | 'next', rawPiece: IBlueprintPiece): IBlueprintPieceInstance {
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

		const trimmedPiece: IBlueprintPiece = _.pick(rawPiece, IBlueprintPieceSampleKeys)

		const piece = postProcessPieces(
			this,
			[trimmedPiece],
			this.getShowStyleBase().blueprintId,
			partInstance.rundownId,
			partInstance.segmentId,
			partInstance.part._id,
			part === 'current',
			true
		)[0]
		piece._id = getRandomId() // Make id random, as postProcessPieces is too predictable (for ingest)
		const newPieceInstance = wrapPieceToInstance(piece, partInstance._id)

		// Do the work
		ServerPlayoutAdLibAPI.innerStartAdLibPiece(
			this._cache,
			this.rundownPlaylist,
			rundown,
			partInstance,
			newPieceInstance
		)

		if (part === 'current') {
			this.currentPartState = Math.max(this.currentPartState, ActionPartChange.SAFE_CHANGE)
		} else {
			this.nextPartState = Math.max(this.nextPartState, ActionPartChange.SAFE_CHANGE)
		}

		return clone(unprotectObject(newPieceInstance))
	}
	updatePieceInstance(pieceInstanceId: string, piece: Partial<OmitId<IBlueprintPiece>>): IBlueprintPieceInstance {
		// filter the submission to the allowed ones
		const trimmedPiece: Partial<OmitId<IBlueprintPiece>> = _.pick(piece, IBlueprintPieceSampleKeys)
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
			pieceInstance.partInstanceId === this.rundownPlaylist.currentPartInstanceId
				? ActionPartChange.SAFE_CHANGE
				: ActionPartChange.NONE
		const updatesNextPart: ActionPartChange =
			pieceInstance.partInstanceId === this.rundownPlaylist.nextPartInstanceId
				? ActionPartChange.SAFE_CHANGE
				: ActionPartChange.NONE
		if (!updatesCurrentPart && !updatesNextPart) {
			throw new Error('Can only update piece instances in current or next part instance')
		}

		if (piece.content && piece.content.timelineObjects) {
			piece.content.timelineObjects = postProcessTimelineObjects(
				this,
				pieceInstance.piece._id,
				this.getShowStyleBase().blueprintId,
				piece.content.timelineObjects,
				true
			)
		}

		const update = {
			$set: {},
			$unset: {},
		}

		for (const [k, val] of Object.entries(trimmedPiece)) {
			if (val === undefined) {
				update.$unset[`piece.${k}`] = val
			} else {
				update.$set[`piece.${k}`] = val
			}
		}

		setupPieceInstanceInfiniteProperties(pieceInstance)

		this._cache.PieceInstances.update(pieceInstance._id, update)

		this.nextPartState = Math.max(this.nextPartState, updatesNextPart)
		this.currentPartState = Math.max(this.currentPartState, updatesCurrentPart)

		return clone(unprotectObject(this._cache.PieceInstances.findOne(pieceInstance._id)!))
	}
	queuePart(rawPart: IBlueprintPart, rawPieces: IBlueprintPiece[]): IBlueprintPartInstance {
		const currentPartInstance = this.rundownPlaylist.currentPartInstanceId
			? this._cache.PartInstances.findOne(this.rundownPlaylist.currentPartInstanceId)
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

		const newPartInstance = new PartInstance({
			_id: getRandomId(),
			rundownId: currentPartInstance.rundownId,
			segmentId: currentPartInstance.segmentId,
			takeCount: -1, // Filled in later
			rehearsal: currentPartInstance.rehearsal,
			part: new Part({
				...rawPart,
				_id: getRandomId(),
				rundownId: currentPartInstance.rundownId,
				segmentId: currentPartInstance.segmentId,
				_rank: 99999, // something high, so it will be placed after current part. The rank will be updated later to its correct value
				notes: [],
				invalid: false,
				invalidReason: undefined,
				floated: false,
			}),
		})

		if (!newPartInstance.part.isPlayable()) {
			throw new Error('Cannot queue a part which is not playable')
		}

		const pieces = postProcessPieces(
			this,
			rawPieces,
			this.getShowStyleBase().blueprintId,
			currentPartInstance.rundownId,
			newPartInstance.segmentId,
			newPartInstance.part._id
		)
		const newPieceInstances = pieces.map((piece) => wrapPieceToInstance(piece, newPartInstance._id))

		// Do the work
		ServerPlayoutAdLibAPI.innerStartQueuedAdLib(
			this._cache,
			this.rundownPlaylist,
			this.rundown,
			currentPartInstance,
			newPartInstance,
			newPieceInstances
		)

		this.nextPartState = ActionPartChange.SAFE_CHANGE

		return clone(unprotectObject(newPartInstance))
	}
	updatePartInstance(part: 'current' | 'next', props: Partial<IBlueprintMutatablePart>): IBlueprintPartInstance {
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

		const update = {
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

		return clone(unprotectObject(this._cache.PartInstances.findOne(partInstance._id)!))
	}

	stopPiecesOnLayers(sourceLayerIds: string[], timeOffset?: number | undefined): string[] {
		if (sourceLayerIds.length == 0) {
			return []
		}

		return this._stopPiecesByRule(
			(pieceInstance) => sourceLayerIds.indexOf(pieceInstance.piece.sourceLayerId) !== -1,
			timeOffset
		)
	}
	stopPieceInstances(pieceInstanceIds: string[], timeOffset?: number | undefined): string[] {
		if (pieceInstanceIds.length == 0) {
			return []
		}

		return this._stopPiecesByRule(
			(pieceInstance) => pieceInstanceIds.indexOf(unprotectString(pieceInstance._id)) !== -1,
			timeOffset
		)
	}
	removePieceInstances(_part: 'next', pieceInstanceIds: string[]): string[] {
		const partInstanceId = this.rundownPlaylist.nextPartInstanceId // this._getPartInstanceId(part)
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

	private _stopPiecesByRule(filter: (pieceInstance: PieceInstance) => boolean, timeOffset: number | undefined) {
		if (!this.rundownPlaylist.currentPartInstanceId) {
			return []
		}
		const partInstance = this._cache.PartInstances.findOne(this.rundownPlaylist.currentPartInstanceId)
		if (!partInstance) {
			throw new Error('Cannot stop pieceInstances when no current partInstance')
		}

		const stoppedIds = ServerPlayoutAdLibAPI.innerStopPieces(
			this._cache,
			this.getShowStyleBase(),
			partInstance,
			filter,
			timeOffset
		)

		if (stoppedIds.length > 0) {
			this.currentPartState = Math.max(this.currentPartState, ActionPartChange.SAFE_CHANGE)
		}

		return unprotectStringArray(stoppedIds)
	}
	takeAfterExecuteAction(take: boolean): boolean {
		this.takeAfterExecute = take

		return this.takeAfterExecute
	}
}

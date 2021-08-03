import {
	getHash,
	formatDateAsTimecode,
	formatDurationAsTimecode,
	unprotectString,
	unprotectObject,
	unprotectObjectArray,
	protectString,
	getCurrentTime,
	protectStringArray,
	unDeepString,
	waitForPromise,
} from '../../../../lib/lib'
import { check } from '../../../../lib/check'
import { logger } from '../../../../lib/logging'
import {
	ICommonContext,
	IStudioContext,
	IStudioUserContext,
	BlueprintMappings,
	IBlueprintSegmentDB,
	IBlueprintPartInstance,
	IBlueprintPieceInstance,
	IBlueprintRundownDB,
	IBlueprintExternalMessageQueueObj,
	IShowStyleContext,
	IRundownContext,
	IRundownDataChangedEventContext,
	IRundownTimingEventContext,
	PackageInfo,
	IShowStyleUserContext,
} from '@sofie-automation/blueprints-integration'
import { Studio, StudioId } from '../../../../lib/collections/Studios'
import {
	ConfigRef,
	getStudioBlueprintConfig,
	resetStudioBlueprintConfig,
	getShowStyleBlueprintConfig,
	resetShowStyleBlueprintConfig,
} from '../config'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { ShowStyleCompound } from '../../../../lib/collections/ShowStyleVariants'
import { NoteType, INoteBase } from '../../../../lib/api/notes'
import { RundownPlaylistId } from '../../../../lib/collections/RundownPlaylists'
import { PieceInstances, unprotectPieceInstanceArray } from '../../../../lib/collections/PieceInstances'
import {
	unprotectPartInstance,
	PartInstance,
	PartInstances,
	protectPartInstance,
	unprotectPartInstanceArray,
} from '../../../../lib/collections/PartInstances'
import { ExternalMessageQueue } from '../../../../lib/collections/ExternalMessageQueue'
import { ReadonlyDeep } from 'type-fest'
import { Segments } from '../../../../lib/collections/Segments'
import { Meteor } from 'meteor/meteor'
import { WatchedPackagesHelper } from './watchedPackages'

export interface ContextInfo {
	/** Short name for the context (eg the blueprint function being called) */
	name: string
	/** Full identifier info for the context. Should be able to identify the rundown/studio/blueprint etc being executed */
	identifier: string
}
export interface UserContextInfo extends ContextInfo {
	tempSendUserNotesIntoBlackHole?: boolean // TODO-CONTEXT remove this
}

/** Common */

export class CommonContext implements ICommonContext {
	private readonly _contextIdentifier: string
	private readonly _contextName: string

	private hashI = 0
	private hashed: { [hash: string]: string } = {}

	constructor(info: ContextInfo) {
		this._contextIdentifier = info.identifier
		this._contextName = info.name
	}
	getHashId(str: string, isNotUnique?: boolean) {
		if (!str) str = 'hash' + this.hashI++

		if (isNotUnique) {
			str = str + '_' + this.hashI++
		}

		const id = getHash(this._contextIdentifier + '_' + str.toString())
		this.hashed[id] = str
		return id
	}
	unhashId(hash: string): string {
		return this.hashed[hash] || hash
	}

	logDebug(message: string): void {
		logger.debug(`"${this._contextName}": "${message}"\n(${this._contextIdentifier})`)
	}
	logInfo(message: string): void {
		logger.info(`"${this._contextName}": "${message}"\n(${this._contextIdentifier})`)
	}
	logWarning(message: string): void {
		logger.warn(`"${this._contextName}": "${message}"\n(${this._contextIdentifier})`)
	}
	logError(message: string): void {
		logger.error(`"${this._contextName}": "${message}"\n(${this._contextIdentifier})`)
	}
}

/** Studio */

export class StudioContext extends CommonContext implements IStudioContext {
	public readonly studio: ReadonlyDeep<Studio>
	constructor(contextInfo: ContextInfo, studio: ReadonlyDeep<Studio>) {
		super(contextInfo)
		this.studio = studio
	}

	public get studioId(): string {
		return unprotectString(this.studio._id)
	}

	public get studioIdProtected(): StudioId {
		return this.studio._id
	}

	getStudioConfig(): unknown {
		return waitForPromise(getStudioBlueprintConfig(this.studio))
	}
	protected async wipeCache(): Promise<void> {
		await resetStudioBlueprintConfig(this.studio)
	}
	getStudioConfigRef(configKey: string): string {
		return ConfigRef.getStudioConfigRef(this.studio._id, configKey)
	}
	getStudioMappings(): Readonly<BlueprintMappings> {
		// @ts-ignore ProtectedString deviceId not compatible with string
		return this.studio.mappings
	}
}

export class StudioUserContext extends StudioContext implements IStudioUserContext {
	public readonly notes: INoteBase[] = []
	private readonly tempSendNotesIntoBlackHole: boolean

	constructor(contextInfo: UserContextInfo, studio: ReadonlyDeep<Studio>) {
		super(contextInfo, studio)
		this.tempSendNotesIntoBlackHole = contextInfo.tempSendUserNotesIntoBlackHole ?? false
	}

	notifyUserError(message: string, params?: { [key: string]: any }): void {
		if (this.tempSendNotesIntoBlackHole) {
			this.logError(`UserNotes: "${message}", ${JSON.stringify(params)}`)
		} else {
			this.notes.push({
				type: NoteType.ERROR,
				message: {
					key: message,
					args: params,
				},
			})
		}
	}
	notifyUserWarning(message: string, params?: { [key: string]: any }): void {
		if (this.tempSendNotesIntoBlackHole) {
			this.logWarning(`UserNotes: "${message}", ${JSON.stringify(params)}`)
		} else {
			this.notes.push({
				type: NoteType.WARNING,
				message: {
					key: message,
					args: params,
				},
			})
		}
	}
}

/** Show Style Variant */
export class ShowStyleContext extends StudioContext implements IShowStyleContext {
	constructor(
		contextInfo: ContextInfo,
		studio: ReadonlyDeep<Studio>,
		public readonly showStyleCompound: ReadonlyDeep<ShowStyleCompound>
	) {
		super(contextInfo, studio)
	}

	getShowStyleConfig(): unknown {
		return waitForPromise(getShowStyleBlueprintConfig(this.showStyleCompound))
	}
	async wipeCache(): Promise<void> {
		await super.wipeCache()
		await resetShowStyleBlueprintConfig(this.showStyleCompound)
	}
	getShowStyleConfigRef(configKey: string): string {
		return ConfigRef.getShowStyleConfigRef(this.showStyleCompound.showStyleVariantId, configKey)
	}
}

export class ShowStyleUserContext extends ShowStyleContext implements IShowStyleUserContext {
	public readonly notes: INoteBase[] = []
	private readonly tempSendNotesIntoBlackHole: boolean

	constructor(
		contextInfo: UserContextInfo,
		studio: ReadonlyDeep<Studio>,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		private readonly watchedPackages: WatchedPackagesHelper
	) {
		super(contextInfo, studio, showStyleCompound)
		this.tempSendNotesIntoBlackHole = contextInfo.tempSendUserNotesIntoBlackHole ?? false
	}

	notifyUserError(message: string, params?: { [key: string]: any }): void {
		if (this.tempSendNotesIntoBlackHole) {
			this.logError(`UserNotes: "${message}", ${JSON.stringify(params)}`)
		} else {
			this.notes.push({
				type: NoteType.ERROR,
				message: {
					key: message,
					args: params,
				},
			})
		}
	}
	notifyUserWarning(message: string, params?: { [key: string]: any }): void {
		if (this.tempSendNotesIntoBlackHole) {
			this.logWarning(`UserNotes: "${message}", ${JSON.stringify(params)}`)
		} else {
			this.notes.push({
				type: NoteType.WARNING,
				message: {
					key: message,
					args: params,
				},
			})
		}
	}

	getPackageInfo(packageId: string): Readonly<Array<PackageInfo.Any>> {
		return this.watchedPackages.getPackageInfo(packageId)
	}
}

/** Rundown */

export class RundownContext extends ShowStyleContext implements IRundownContext {
	readonly rundownId: string
	readonly rundown: Readonly<IBlueprintRundownDB>
	readonly _rundown: ReadonlyDeep<Rundown>
	readonly playlistId: RundownPlaylistId

	constructor(
		contextInfo: ContextInfo,
		studio: ReadonlyDeep<Studio>,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		rundown: ReadonlyDeep<Rundown>
	) {
		super(contextInfo, studio, showStyleCompound)

		this.rundownId = unprotectString(rundown._id)
		this.rundown = unprotectObject(rundown)
		this._rundown = rundown
		this.playlistId = rundown.playlistId
	}
}

export interface RawPartNote extends INoteBase {
	partExternalId: string | undefined
}

/** Events */

export class RundownDataChangedEventContext extends RundownContext implements IRundownDataChangedEventContext {
	constructor(
		contextInfo: ContextInfo,
		studio: ReadonlyDeep<Studio>,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		rundown: ReadonlyDeep<Rundown>
	) {
		super(contextInfo, studio, showStyleCompound, rundown)
	}

	getCurrentTime(): number {
		return getCurrentTime()
	}

	/** Get all unsent and queued messages in the rundown */
	getAllUnsentQueuedMessages(): Readonly<IBlueprintExternalMessageQueueObj[]> {
		return unprotectObjectArray(
			ExternalMessageQueue.find(
				{
					rundownId: this._rundown._id,
					queueForLaterReason: { $exists: true },
				},
				{
					sort: {
						created: 1,
					},
				}
			).fetch()
		)
	}

	formatDateAsTimecode(time: number): string {
		check(time, Number)
		return formatDateAsTimecode(new Date(time))
	}
	formatDurationAsTimecode(time: number): string {
		check(time, Number)
		return formatDurationAsTimecode(time)
	}
}

export class RundownTimingEventContext extends RundownDataChangedEventContext implements IRundownTimingEventContext {
	readonly previousPart: Readonly<IBlueprintPartInstance<unknown>> | undefined
	private readonly _currentPart: PartInstance
	readonly nextPart: Readonly<IBlueprintPartInstance<unknown>> | undefined

	public get currentPart(): Readonly<IBlueprintPartInstance<unknown>> {
		return unprotectPartInstance(this._currentPart)
	}

	constructor(
		contextInfo: ContextInfo,
		studio: ReadonlyDeep<Studio>,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		rundown: ReadonlyDeep<Rundown>,
		previousPartInstance: PartInstance | undefined,
		partInstance: PartInstance,
		nextPartInstance: PartInstance | undefined
	) {
		super(contextInfo, studio, showStyleCompound, rundown)

		this.previousPart = unprotectPartInstance(previousPartInstance)
		this._currentPart = partInstance
		this.nextPart = unprotectPartInstance(nextPartInstance)
	}

	getFirstPartInstanceInRundown(): Readonly<IBlueprintPartInstance<unknown>> {
		const partInstance = PartInstances.findOne(
			{
				rundownId: this._rundown._id,
				playlistActivationId: this._currentPart.playlistActivationId,
			},
			{
				sort: {
					takeCount: 1,
				},
			}
		)

		// If this doesn't find anything, then where did our reference PartInstance come from?
		if (!partInstance)
			throw new Meteor.Error(
				500,
				`No PartInstances found for Rundown "${this._rundown._id}" (PlaylistActivationId "${this._currentPart.playlistActivationId}")`
			)

		return unprotectPartInstance(partInstance)
	}

	getPartInstancesInSegmentPlayoutId(
		refPartInstance: Readonly<IBlueprintPartInstance<unknown>>
	): readonly IBlueprintPartInstance<unknown>[] {
		const refPartInstance2 = protectPartInstance(refPartInstance)
		if (!refPartInstance2 || !refPartInstance2.segmentId || !refPartInstance2.segmentPlayoutId)
			throw new Meteor.Error(500, '')

		const partInstances = PartInstances.find(
			{
				rundownId: this._rundown._id,
				playlistActivationId: this._currentPart.playlistActivationId,
				segmentId: unDeepString(refPartInstance2.segmentId),
				segmentPlayoutId: unDeepString(refPartInstance2.segmentPlayoutId),
			},
			{
				sort: {
					takeCount: 1,
				},
			}
		).fetch()

		return unprotectPartInstanceArray(partInstances)
	}

	getPieceInstances(...partInstanceIds: string[]): readonly IBlueprintPieceInstance<unknown>[] {
		if (partInstanceIds.length === 0) return []

		const pieceInstances = PieceInstances.find({
			rundownId: this._rundown._id,
			playlistActivationId: this._currentPart.playlistActivationId,
			partInstanceId: { $in: protectStringArray(partInstanceIds) },
		}).fetch()

		return unprotectPieceInstanceArray(pieceInstances)
	}

	getSegment(segmentId: string): Readonly<IBlueprintSegmentDB<unknown>> | undefined {
		check(segmentId, String)
		return unprotectObject(
			Segments.findOne({
				_id: protectString(segmentId),
				rundownId: this._rundown._id,
			})
		)
	}
}

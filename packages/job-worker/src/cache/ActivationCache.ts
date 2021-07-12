import { StudioId, RundownPlaylistId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { RundownBaselineObj } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineObj'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBShowStyleBase } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { clone } from '@sofie-automation/corelib/dist/lib'
import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { ReadonlyDeep } from 'type-fest'

export function getActivationCache(studioId: StudioId, playlistId: RundownPlaylistId): ActivationCache {
	let activationCache = activationCaches.get(studioId)
	if (activationCache && getValidActivationCache(studioId, playlistId)) {
		activationCache.touch()
	} else {
		if (activationCache) activationCache.destroy()

		activationCache = new ActivationCache(playlistId)
		activationCaches.set(studioId, activationCache)
	}

	return activationCache
}
/** Only return an activationCache if one is found */
export function getValidActivationCache(
	studioId: StudioId,
	playlistId?: RundownPlaylistId
): ActivationCache | undefined {
	const activationCache = activationCaches.get(studioId)
	if (
		activationCache &&
		!activationCache.expired &&
		activationCache.persistant &&
		(!playlistId || activationCache.playlistId === playlistId)
	) {
		return activationCache
	} else {
		return undefined
	}
}
export function clearActivationCache(studioId: StudioId): void {
	const activationCache = activationCaches.get(studioId)
	if (activationCache) {
		activationCache.destroy()
		activationCaches.delete(studioId)
	}
}
export function clearOldActivationCaches() {
	for (const [id, activationCache] of activationCaches) {
		if (activationCache.expired) clearActivationCache(id)
	}
}
export function forceClearAllActivationCaches() {
	for (const id of activationCaches.keys()) {
		clearActivationCache(id)
	}
}
const activationCaches = new Map<StudioId, ActivationCache>()

type InternalCache<T> = { modifiedHash: string; value: T }
/**
 * The ActivationCache is designed to be generated once (or very few times) during the playout of a rundown.
 * It is generated upon activation and preserves various documents in memory that should never change during playout of a rundown
 */
export class ActivationCache {
	private _expires!: number
	private _initialized = false
	private _persistant = false

	private _playlist: DBRundownPlaylist | undefined
	private _studio: DBStudio | undefined
	private _showStyleBases: { [id: string]: InternalCache<DBShowStyleBase> } = {}
	private _showStyleVariants: { [id: string]: InternalCache<DBShowStyleVariant> } = {}
	private _rundownBaselineObjs: { [id: string]: InternalCache<RundownBaselineObj[]> } = {}
	private _peripheralDevices: { [id: string]: InternalCache<PeripheralDevice[]> } = {}

	constructor(private _playlistId: RundownPlaylistId) {
		this._updateExpires()
	}

	get expired(): boolean {
		return Date.now() > this._expires
	}
	get persistant(): boolean {
		return this._persistant
	}
	get playlistId(): RundownPlaylistId {
		return this._playlistId
	}
	touch() {
		this._updateExpires()
	}
	destroy() {
		// do something here?
	}
	private _uninitialize() {
		delete this._playlist
		delete this._studio
		this._showStyleBases = {}
		this._showStyleVariants = {}
		this._rundownBaselineObjs = {}
		this._peripheralDevices = {}

		this._initialized = false
		this._persistant = false
	}
	async initialize(playlist: ReadonlyDeep<DBRundownPlaylist>, rundownsInPlaylist: DBRundown[]) {
		if (this._initialized && (!this._playlist || playlist.activationId !== this._playlist.activationId)) {
			// activationId has changed, we should clear out the data because it might not be valid anymore
			this._uninitialize()
		}

		if (this._initialized) return // already initialized

		if (playlist._id !== this._playlistId)
			throw new Error(
				`ActivationCache.initialize playlist._id "${playlist._id}" not equal to this.playlistId "${this.playlistId}"`
			)
		this._playlist = clone<DBRundownPlaylist>(playlist)

		const pStudio = Studios.findOneAsync(this._playlist.studioId)

		if (!playlist.activationId) {
			// If the playlist is not active we won't do the pre-loading now
			// we're also not calling ourselves "persistant", so we won't be living longer than
			this._persistant = false
		} else {
			this._persistant = true

			// As a convenience thing; if we're persistant, we should be the one stored in the cache:
			const existingInCache = activationCaches.get(this._playlist.studioId)
			if (existingInCache && existingInCache !== this) {
				existingInCache.destroy()
			}
			activationCaches.set(this._playlist.studioId, this)

			// Just a prefetch, to speed up things later:
			const ps: Promise<any>[] = []
			const ignoreError = () => {
				// ignore
			}
			for (const rundown of rundownsInPlaylist) {
				ps.push(this._getShowStyleBase(rundown).catch(ignoreError))
				ps.push(this._getShowStyleVariant(rundown).catch(ignoreError))
				ps.push(this._getRundownBaselineObjs(rundown))
			}
			ps.push(this._getPeripheralDevices())

			await Promise.all(ps)
		}
		const studio = await pStudio
		if (!studio) {
			throw new Error(`Studio "${this._playlist.studioId}" of playlist "${this._playlist._id}" not found!`)
		}

		this._studio = studio
		this._initialized = true
	}
	/** This is indended to be used when there is no playlist active */
	async initializeForNoPlaylist(studio: DBStudio) {
		if (this._initialized) return // already initialized

		// see the note about this._persistant = false in this.initialize()
		this._persistant = false

		this._studio = studio
		this._initialized = true
	}
	getPlaylist(): DBRundownPlaylist {
		if (!this._initialized) throw new Error(`ActivationCache is not initialized`)
		if (!this._playlist) throw new Error(`ActivationCache is without playlist`)
		return this._playlist
	}
	getStudio(): DBStudio {
		if (!this._initialized || !this._studio) throw new Error(`ActivationCache is not initialized`)
		return this._studio
	}
	async getShowStyleBase(rundown: DBRundown): Promise<DBShowStyleBase> {
		if (!this._initialized) throw new Error(`ActivationCache is not initialized`)
		return this._getShowStyleBase(rundown)
	}
	async getShowStyleVariant(rundown: DBRundown): Promise<DBShowStyleVariant> {
		if (!this._initialized) throw new Error(`ActivationCache is not initialized`)
		return this._getShowStyleVariant(rundown)
	}
	async getShowStyleCompound(rundown: DBRundown): Promise<ShowStyleCompound> {
		const [base, variant] = await Promise.all([this.getShowStyleBase(rundown), this.getShowStyleVariant(rundown)])
		const compound = createShowStyleCompound(base, variant)
		if (!compound)
			throw new Error(`Unable to compile ShowStyleCompound for variant "${rundown.showStyleVariantId}"`)
		return compound
	}
	async getRundownBaselineObjs(rundown: DBRundown): Promise<RundownBaselineObj[]> {
		if (!this._initialized) throw new Error(`ActivationCache is not initialized`)
		return this._getRundownBaselineObjs(rundown)
	}
	async getPeripheralDevices(): Promise<PeripheralDevice[]> {
		if (!this._initialized) throw new Error(`ActivationCache is not initialized`)
		return this._getPeripheralDevices()
	}
	private async _getShowStyleBase(rundown: DBRundown): Promise<DBShowStyleBase> {
		if (!rundown.showStyleBaseId) throw new Error(`Rundown.showStyleBaseId not set!`)
		return this._getFromCache(this._showStyleBases, rundown.showStyleBaseId, '', async (id) => {
			const showStyleBase = await ShowStyleBases.findOneAsync(id)
			if (!showStyleBase) throw new Error(`ShowStyleBase "${id}" not found`)
			return showStyleBase
		})
	}
	private async _getShowStyleVariant(rundown: DBRundown): Promise<DBShowStyleVariant> {
		if (!rundown.showStyleVariantId) throw new Error(`Rundown.showStyleVariantId not set!`)
		return this._getFromCache(this._showStyleVariants, rundown.showStyleVariantId, '', async (id) => {
			const showStyleVariant = await ShowStyleVariants.findOneAsync(id)
			if (!showStyleVariant) throw new Error(`ShowStyleVariant "${id}" not found`)
			return showStyleVariant
		})
	}
	private async _getRundownBaselineObjs(rundown: DBRundown): Promise<RundownBaselineObj[]> {
		return this._getFromCache(
			this._rundownBaselineObjs,
			rundown._id,
			rundown.baselineModifyHash || '',
			async (id) => {
				const rundownBaselineObjs = await RundownBaselineObjs.findFetchAsync({ rundownId: id })
				return rundownBaselineObjs
			}
		)
	}
	private async _getPeripheralDevices(): Promise<PeripheralDevice[]> {
		const studioId = this._playlist?.studioId ?? this._studio?._id
		if (!studioId) return []

		return this._getFromCache(this._peripheralDevices, studioId, '', async (id) => {
			const devices = await PeripheralDevices.findFetchAsync({
				studioId: id,
			})
			return devices
		})
	}
	private _updateExpires() {
		const TTL = 30 * 60 * 1000 // 30 minutes

		this._expires = Date.now() + TTL
	}
	private async _getFromCache<T, ID extends string | ProtectedString<any>>(
		cache: { [id: string]: InternalCache<T> },
		identifier: ID,
		modifiedHash: string,
		updateFcn: (identifier: ID) => Promise<T>
	): Promise<T> {
		const id = identifier as any as string
		let o = cache[id]
		if (!o || o.modifiedHash !== modifiedHash) {
			o = {
				modifiedHash: modifiedHash,
				value: await updateFcn(identifier),
			}
			cache[id] = o
		}
		return o.value
	}
}

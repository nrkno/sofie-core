import {
	BlueprintConfigCoreConfig,
	BlueprintManifestType,
	BlueprintResultApplyStudioConfig,
	BlueprintResultRundownPlaylist,
	BlueprintResultStudioBaseline,
	ExtendedIngestRundown,
	IBlueprintConfig,
	IBlueprintRundownDB,
	IBlueprintShowStyleBase,
	ICommonContext,
	IConfigMessage,
	IPackageInfoContext,
	IShowStyleConfigPreset,
	IStudioBaselineContext,
	IStudioContext,
	IStudioUserContext,
	IUserNotesContext,
	JSONBlob,
	JSONBlobStringify,
	JSONSchema,
	MigrationStepStudio,
	StudioBlueprintManifest,
} from '@sofie-automation/blueprints-integration'
import { getRandomString, stringifyError } from '@sofie-automation/corelib/dist/lib'
import { logger } from '../logging'
import * as SocketIOClient from 'socket.io-client'
import type { ClientToServerEvents, ResultCallback, ServerToClientEvents } from '@sofie-automation/blueprints-proxy'
import { ReadonlyDeep } from 'type-fest'
import { CommonContext, StudioBaselineContext, StudioUserContext } from './context'
import { EventHandlers, listenToEvents, ParamsIfReturnIsValid } from '@sofie-automation/blueprints-proxy/dist/helper'

type MyClient = SocketIOClient.Socket<ServerToClientEvents, ClientToServerEvents>

export class ProxiedStudioBlueprint implements StudioBlueprintManifest {
	readonly blueprintType = BlueprintManifestType.STUDIO // s

	readonly #client: MyClient = SocketIOClient.io('http://localhost:2345', {
		reconnection: true,
		// timeout: 5000,
		autoConnect: true,
		// transports: ['websocket'],
	}) as MyClient
	readonly #callHandlers = new Map<string, Partial<EventHandlers<ServerToClientEvents>>>()

	/** Unique id of the blueprint. This is used by core to check if blueprints are the same blueprint, but differing versions */
	blueprintId?: string
	/** Version of the blueprint */
	blueprintVersion = '0.0.0'
	/** Version of the blueprint-integration that the blueprint depend on */
	integrationVersion = '0.0.0'
	/** Version of the TSR-types that the blueprint depend on */
	TSRVersion = '0.0.0'

	/** A list of config items this blueprint expects to be available on the ShowStyle */
	studioConfigSchema: JSONBlob<JSONSchema> = JSONBlobStringify({})
	/** A list of Migration steps related to a ShowStyle */
	studioMigrations: MigrationStepStudio[] = []

	/** The config presets exposed by this blueprint */
	configPresets: Record<string, IShowStyleConfigPreset<IBlueprintConfig>> = {}

	/** Translations connected to the studio (as stringified JSON) */
	translations?: string

	constructor() {
		logger.info('Creating ShowStyle blueprint proxy')

		this.#client.connect()

		this.#client.on('connect', () => {
			console.log('conencted')
			// TODO - load constants from blueprints
		})

		this.#client.on('connect_error', (err) => {
			console.log('conencted failed', err, err?.message, err?.toString())
			// TODO - load constants from blueprints
		})

		this.#client.on('disconnect', () => {
			console.log('disconnect')

			this.#callHandlers.clear()

			// TODO - abort any in-progress?
		})

		listenToEvents<ServerToClientEvents>(this.#client, this.#generateListenerRouter())
	}

	async #handleListen<T extends keyof ServerToClientEvents>(
		name: T,
		functionId: string,
		...args: Parameters<ServerToClientEvents[T]>
	): Promise<any> {
		const handlers = this.#callHandlers.get(functionId)
		const handler = handlers?.[name] as any
		if (!handler) throw new Error(`Method "${name}" is not supported`)

		return handler(functionId, ...args)
	}
	#handleListen2<T extends keyof ServerToClientEvents>(
		name: T,
		functionId: string,
		...args: Parameters<ServerToClientEvents[T]>
	): void {
		const handlers = this.#callHandlers.get(functionId)
		const handler = handlers?.[name] as any
		if (!handler) throw new Error(`Method "${name}" is not supported`)

		try {
			handler(functionId, ...args)
		} catch (e) {
			logger.error(stringifyError(e))
		}
	}

	#generateListenerRouter(): EventHandlers<ServerToClientEvents> {
		return {
			common_notifyUserError: (...args) => this.#handleListen2('common_notifyUserError', ...args),
			common_notifyUserWarning: (...args) => this.#handleListen2('common_notifyUserWarning', ...args),
			common_notifyUserInfo: (...args) => this.#handleListen2('common_notifyUserInfo', ...args),

			packageInfo_getPackageInfo: async (...args) => this.#handleListen('packageInfo_getPackageInfo', ...args),
			packageInfo_hackGetMediaObjectDuration: async (...args) =>
				this.#handleListen('packageInfo_hackGetMediaObjectDuration', ...args),
			studio_getStudioMappings: async (...args) => this.#handleListen('studio_getStudioMappings', ...args),
		}
	}

	async #runProxied<T extends keyof ClientToServerEvents>(
		name: T,
		functionId: string,
		data: ParamsIfReturnIsValid<ClientToServerEvents[T]>[0]
	): Promise<ReturnType<ClientToServerEvents[T]>> {
		if (!this.#client.connected) throw new Error('Blueprints are unavailable')

		// TODO - ensure #callHandlers is cleaned up

		// TODO - timeouts?
		return new Promise<ReturnType<ClientToServerEvents[T]>>((resolve, reject) => {
			const handleDisconnect = () => {
				reject('Client disconnected')
			}
			this.#client.once('disconnect', handleDisconnect)

			const innerCb: ResultCallback<ReturnType<ClientToServerEvents[T]>> = (
				err: any,
				res: ReturnType<ClientToServerEvents[T]>
			): void => {
				this.#client.off('disconnect', handleDisconnect)
				this.#callHandlers.delete(functionId)

				if (err) reject(err)
				else resolve(res)
			}
			this.#client.emit(name as any, functionId, data, innerCb)
		})
	}

	#listenToEventsForMethod(functionId: string, handlers: EventHandlers<Partial<ServerToClientEvents>>): void {
		if (this.#callHandlers.has(functionId)) {
			logger.warn(`Methods already registered for call ${functionId}`)
		}

		this.#callHandlers.set(functionId, handlers)
	}

	#packageInfoContextMethods(context: IPackageInfoContext): EventHandlers<Partial<ServerToClientEvents>> {
		return {
			packageInfo_getPackageInfo: async (_id, data) => context.getPackageInfo(data.packageId),
			packageInfo_hackGetMediaObjectDuration: async (_id, data) =>
				context.hackGetMediaObjectDuration(data.mediaId),
		}
	}

	#studioContextMethods(context: IStudioContext): EventHandlers<Partial<ServerToClientEvents>> {
		return {
			studio_getStudioMappings: async (_id) => context.getStudioMappings(),
		}
	}

	#userNotesContextMethods(context: IUserNotesContext): EventHandlers<Partial<ServerToClientEvents>> {
		return {
			common_notifyUserError: (_id, msg) => context.notifyUserError(msg.message, msg.params),
			common_notifyUserWarning: (_id, msg) => context.notifyUserWarning(msg.message, msg.params),
			common_notifyUserInfo: (_id, msg) => context.notifyUserInfo(msg.message, msg.params),
		}
	}

	#studioUserContextMethods(context: IStudioUserContext): EventHandlers<Partial<ServerToClientEvents>> {
		return {
			...this.#studioContextMethods(context),
			...this.#userNotesContextMethods(context),
		}
	}

	/** Returns the items used to build the baseline (default state) of a studio, this is the baseline used when there's no active rundown */
	async getBaseline(context0: IStudioBaselineContext): Promise<BlueprintResultStudioBaseline> {
		const context = context0 as StudioBaselineContext

		const id = getRandomString()
		this.#listenToEventsForMethod(id, {
			...this.#studioContextMethods(context),
			...this.#packageInfoContextMethods(context),
		})

		return this.#runProxied('studio_getBaseline', id, {
			identifier: context._contextIdentifier,
			studioId: context.studioId,
			studioConfig: context.getStudioConfig() as IBlueprintConfig,
		})
	}

	/** Returns the id of the show style to use for a rundown, return null to ignore that rundown */
	async getShowStyleId(
		context0: IStudioUserContext,
		showStyles: ReadonlyDeep<Array<IBlueprintShowStyleBase>>,
		ingestRundown: ExtendedIngestRundown
	): Promise<string | null> {
		const context = context0 as StudioUserContext

		const id = getRandomString()
		this.#listenToEventsForMethod(id, {
			...this.#studioUserContextMethods(context),
		})

		return this.#runProxied('studio_getShowStyleId', id, {
			identifier: context._contextIdentifier,
			studioId: context.studioId,
			studioConfig: context.getStudioConfig() as IBlueprintConfig,

			showStyles,
			ingestRundown,
		})
	}

	/** Returns information about the playlist this rundown is a part of, return null to not make it a part of a playlist */
	async getRundownPlaylistInfo(
		context0: IStudioUserContext,
		rundowns: IBlueprintRundownDB[],
		playlistExternalId: string
	): Promise<BlueprintResultRundownPlaylist | null> {
		const context = context0 as StudioUserContext

		// TODO - handle this method being optional

		const id = getRandomString()
		this.#listenToEventsForMethod(id, {
			...this.#studioUserContextMethods(context),
		})

		return this.#runProxied('studio_getRundownPlaylistInfo', id, {
			identifier: context._contextIdentifier,
			studioId: context.studioId,
			studioConfig: context.getStudioConfig() as IBlueprintConfig,

			rundowns,
			playlistExternalId,
		})
	}

	async validateConfig(context0: ICommonContext, config: IBlueprintConfig): Promise<Array<IConfigMessage>> {
		const context = context0 as CommonContext

		const id = getRandomString()

		// TODO - handle this method being optional

		return this.#runProxied('studio_validateConfig', id, {
			identifier: context._contextIdentifier,
			config,
		})
	}

	/**
	 * Apply the config by generating the data to be saved into the db.
	 * This should be written to give a predictable and stable result, it can be called with the same config multiple times
	 */
	async applyConfig(
		context0: ICommonContext,
		config: IBlueprintConfig,
		coreConfig: BlueprintConfigCoreConfig
	): Promise<BlueprintResultApplyStudioConfig> {
		const context = context0 as CommonContext

		const id = getRandomString()

		// TODO - handle this method being optional

		return this.#runProxied('studio_applyConfig', id, {
			identifier: context._contextIdentifier,
			config,
			coreConfig,
		})
	}

	/** Preprocess config before storing it by core to later be returned by context's getStudioConfig. If not provided, getStudioConfig will return unprocessed blueprint config */
	async preprocessConfig(
		context0: ICommonContext,
		config: IBlueprintConfig,
		coreConfig: BlueprintConfigCoreConfig
	): Promise<unknown> {
		const context = context0 as CommonContext

		const id = getRandomString()

		// TODO - handle this method being optional

		return this.#runProxied('studio_preprocessConfig', id, {
			identifier: context._contextIdentifier,
			config,
			coreConfig,
		})
	}
}

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
import type {
	SofieToBlueprintMethods,
	ResultCallback,
	BlueprintToSofieMethods,
} from '@sofie-automation/blueprints-proxy'
import { ReadonlyDeep } from 'type-fest'
import { CommonContext, StudioBaselineContext, StudioUserContext } from './context'
import { EventHandlers, listenToEvents, ParamsIfReturnIsValid } from '@sofie-automation/blueprints-proxy/dist/helper'

type MyClient = SocketIOClient.Socket<BlueprintToSofieMethods, SofieToBlueprintMethods>

export class ProxiedStudioBlueprint implements StudioBlueprintManifest {
	readonly blueprintType = BlueprintManifestType.STUDIO // s

	readonly #client: MyClient = SocketIOClient.io('http://localhost:2345', {
		reconnection: true,
		// timeout: 5000,
		autoConnect: true,
		// transports: ['websocket'],
	}) as MyClient
	readonly #callHandlers = new Map<string, Partial<EventHandlers<BlueprintToSofieMethods>>>()

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

		listenToEvents<BlueprintToSofieMethods>(this.#client, this.#generateListenerRouter())
	}

	dispose = (): void => {
		// TODO - more?
		this.#callHandlers.clear()

		this.#client.disconnect()
		this.#client.removeAllListeners()
	}

	async #handleFunctionCall<T extends keyof BlueprintToSofieMethods>(
		name: T,
		invocationId: string,
		...args: Parameters<BlueprintToSofieMethods[T]>
	): Promise<any> {
		const handlers = this.#callHandlers.get(invocationId)
		const handler = handlers?.[name] as any
		if (!handler) throw new Error(`Method "${name}" is not supported`)

		return handler(invocationId, ...args)
	}
	#handleVoidFunctionCall<T extends keyof BlueprintToSofieMethods>(
		name: T,
		invocationId: string,
		...args: Parameters<BlueprintToSofieMethods[T]>
	): void {
		const handlers = this.#callHandlers.get(invocationId)
		const handler = handlers?.[name] as any
		if (!handler) throw new Error(`Method "${name}" is not supported`)

		try {
			handler(invocationId, ...args)
		} catch (e) {
			logger.error(stringifyError(e))
		}
	}

	#generateListenerRouter(): EventHandlers<BlueprintToSofieMethods> {
		return {
			common_notifyUserError: (...args) => this.#handleVoidFunctionCall('common_notifyUserError', ...args),
			common_notifyUserWarning: (...args) => this.#handleVoidFunctionCall('common_notifyUserWarning', ...args),
			common_notifyUserInfo: (...args) => this.#handleVoidFunctionCall('common_notifyUserInfo', ...args),

			packageInfo_getPackageInfo: async (...args) =>
				this.#handleFunctionCall('packageInfo_getPackageInfo', ...args),
			packageInfo_hackGetMediaObjectDuration: async (...args) =>
				this.#handleFunctionCall('packageInfo_hackGetMediaObjectDuration', ...args),
			studio_getStudioMappings: async (...args) => this.#handleFunctionCall('studio_getStudioMappings', ...args),
		}
	}

	async #callBlueprintMethod<T extends keyof SofieToBlueprintMethods>(
		name: T,
		invocationId: string,
		data: ParamsIfReturnIsValid<SofieToBlueprintMethods[T]>[0]
	): Promise<ReturnType<SofieToBlueprintMethods[T]>> {
		if (!this.#client.connected) throw new Error('Blueprints are unavailable')

		// TODO - ensure #callHandlers is cleaned up

		// TODO - timeouts?
		return new Promise<ReturnType<SofieToBlueprintMethods[T]>>((resolve, reject) => {
			const handleDisconnect = () => {
				reject('Client disconnected')
			}
			this.#client.once('disconnect', handleDisconnect)

			const innerCb: ResultCallback<ReturnType<SofieToBlueprintMethods[T]>> = (
				err: any,
				res: ReturnType<SofieToBlueprintMethods[T]>
			): void => {
				this.#client.off('disconnect', handleDisconnect)
				this.#callHandlers.delete(invocationId)

				if (err) reject(err)
				else resolve(res)
			}
			this.#client.emit(name as any, invocationId, data, innerCb)
		})
	}

	#listenToEventsForMethod(invocationId: string, handlers: EventHandlers<Partial<BlueprintToSofieMethods>>): void {
		if (this.#callHandlers.has(invocationId)) {
			logger.warn(`Methods already registered for call ${invocationId}`)
		}

		this.#callHandlers.set(invocationId, handlers)
	}

	#packageInfoContextMethods(context: IPackageInfoContext): EventHandlers<Partial<BlueprintToSofieMethods>> {
		return {
			packageInfo_getPackageInfo: async (_invocationId, data) => context.getPackageInfo(data.packageId),
			packageInfo_hackGetMediaObjectDuration: async (_invocationId, data) =>
				context.hackGetMediaObjectDuration(data.mediaId),
		}
	}

	#studioContextMethods(context: IStudioContext): EventHandlers<Partial<BlueprintToSofieMethods>> {
		return {
			studio_getStudioMappings: async (_invocationId) => context.getStudioMappings(),
		}
	}

	#userNotesContextMethods(context: IUserNotesContext): EventHandlers<Partial<BlueprintToSofieMethods>> {
		return {
			common_notifyUserError: (_invocationId, msg) => context.notifyUserError(msg.message, msg.params),
			common_notifyUserWarning: (_invocationId, msg) => context.notifyUserWarning(msg.message, msg.params),
			common_notifyUserInfo: (_invocationId, msg) => context.notifyUserInfo(msg.message, msg.params),
		}
	}

	#studioUserContextMethods(context: IStudioUserContext): EventHandlers<Partial<BlueprintToSofieMethods>> {
		return {
			...this.#studioContextMethods(context),
			...this.#userNotesContextMethods(context),
		}
	}

	/** Returns the items used to build the baseline (default state) of a studio, this is the baseline used when there's no active rundown */
	async getBaseline(context0: IStudioBaselineContext): Promise<BlueprintResultStudioBaseline> {
		const context = context0 as StudioBaselineContext

		const invocationId = getRandomString()
		this.#listenToEventsForMethod(invocationId, {
			...this.#studioContextMethods(context),
			...this.#packageInfoContextMethods(context),
		})

		return this.#callBlueprintMethod('studio_getBaseline', invocationId, {
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

		const invocationId = getRandomString()
		this.#listenToEventsForMethod(invocationId, {
			...this.#studioUserContextMethods(context),
		})

		return this.#callBlueprintMethod('studio_getShowStyleId', invocationId, {
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

		const invocationId = getRandomString()
		this.#listenToEventsForMethod(invocationId, {
			...this.#studioUserContextMethods(context),
		})

		return this.#callBlueprintMethod('studio_getRundownPlaylistInfo', invocationId, {
			identifier: context._contextIdentifier,
			studioId: context.studioId,
			studioConfig: context.getStudioConfig() as IBlueprintConfig,

			rundowns,
			playlistExternalId,
		})
	}

	async validateConfig(context0: ICommonContext, config: IBlueprintConfig): Promise<Array<IConfigMessage>> {
		const context = context0 as CommonContext

		const invocationId = getRandomString()

		// TODO - handle this method being optional

		return this.#callBlueprintMethod('studio_validateConfig', invocationId, {
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

		const invocationId = getRandomString()

		// TODO - handle this method being optional

		return this.#callBlueprintMethod('studio_applyConfig', invocationId, {
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

		const invocationId = getRandomString()

		// TODO - handle this method being optional

		return this.#callBlueprintMethod('studio_preprocessConfig', invocationId, {
			identifier: context._contextIdentifier,
			config,
			coreConfig,
		})
	}
}

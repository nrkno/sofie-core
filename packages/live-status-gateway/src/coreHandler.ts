import { CoreConnection, CoreOptions, DDPConnectorOptions, Observer } from '@sofie-automation/server-core-integration'
import { DeviceConfig } from './connector'
import { Logger } from 'winston'
import { Process } from './process'
import { LIVE_STATUS_DEVICE_CONFIG } from './configManifest'
import {
	PeripheralDeviceCategory,
	PeripheralDeviceType,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { protectString, unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { PeripheralDeviceId, StudioId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { StatusCode } from '@sofie-automation/shared-lib/dist/lib/status'
import { PeripheralDeviceCommand } from '@sofie-automation/shared-lib/dist/core/model/PeripheralDeviceCommand'
import { PeripheralDeviceForDevice } from '@sofie-automation/shared-lib/dist/core/model/peripheralDevice'
import { LiveStatusGatewayConfig } from './generated/options'

export interface CoreConfig {
	host: string
	port: number
	watchdog: boolean
}

/**
 * Represents a connection between the Gateway and Core
 */
export class CoreHandler {
	core!: CoreConnection
	logger: Logger
	public _observers: Array<any> = []
	public deviceSettings: LiveStatusGatewayConfig = {}

	public errorReporting = false
	public multithreading = false
	public reportAllCommands = false

	private _deviceOptions: DeviceConfig
	private _onConnected?: () => any
	private _executedFunctions: { [id: string]: boolean } = {}
	private _coreConfig?: CoreConfig
	private _process?: Process

	private _studioId: StudioId | undefined

	private _statusInitialized = false
	private _statusDestroyed = false

	constructor(logger: Logger, deviceOptions: DeviceConfig) {
		this.logger = logger
		this._deviceOptions = deviceOptions
	}

	async init(config: CoreConfig, process: Process): Promise<void> {
		this._statusInitialized = false
		this._coreConfig = config
		this._process = process

		this.core = new CoreConnection(this.getCoreConnectionOptions())

		this.core.onConnected(() => {
			this.logger.info('Core Connected!')
			this.setupObserversAndSubscriptions().catch((e) => {
				this.logger.error('Core Error during setupObserversAndSubscriptions:', e)
			})
			if (this._onConnected) this._onConnected()
		})
		this.core.onDisconnected(() => {
			this.logger.warn('Core Disconnected!')
		})
		this.core.onError((err) => {
			this.logger.error('Core Error: ' + (typeof err === 'string' ? err : err.message || err.toString() || err))
		})

		const ddpConfig: DDPConnectorOptions = {
			host: config.host,
			port: config.port,
		}
		if (this._process && this._process.certificates.length) {
			ddpConfig.tlsOpts = {
				ca: this._process.certificates,
			}
		}

		await this.core.init(ddpConfig)

		this.logger.info('Core id: ' + this.core.deviceId)
		await this.setupObserversAndSubscriptions()
		if (this._onConnected) this._onConnected()

		this._statusInitialized = true
		await this.updateCoreStatus()
	}

	async setupSubscription(collection: string, ...params: any[]): Promise<string> {
		this.logger.info(`Core: Set up subscription for '${collection}'`)
		const subscriptionId = await this.core.autoSubscribe(collection, ...params)
		this.logger.info(`Core: Subscription for '${collection}' set up with id ${subscriptionId}`)
		return subscriptionId
	}

	unsubscribe(subscriptionId: string): void {
		this.logger.info(`Core: Unsubscribing id '${subscriptionId}'`)
		this.core.unsubscribe(subscriptionId)
	}

	setupObserver(collection: string): Observer {
		return this.core.observe(collection)
	}

	async setupObserversAndSubscriptions(): Promise<void> {
		this.logger.info('Core: Setting up subscriptions..')
		this.logger.info('DeviceId: ' + this.core.deviceId)

		await Promise.all([
			this.core.autoSubscribe('peripheralDeviceForDevice', {
				_id: this.core.deviceId,
			}),
		])
		this.logger.info('Core: Subscriptions are set up!')
		if (this._observers.length) {
			this.logger.info('CoreMos: Clearing observers..')
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}
		// setup observers
		const observer = this.core.observe('peripheralDeviceForDevice')
		observer.added = (id: string) => this.onDeviceChanged(protectString(id))
		observer.changed = (id: string) => this.onDeviceChanged(protectString(id))
	}
	async destroy(): Promise<void> {
		this._statusDestroyed = true
		await this.updateCoreStatus()
		await this.core.destroy()
	}
	private getCoreConnectionOptions(): CoreOptions {
		if (!this._deviceOptions.deviceId) {
			throw new Error('DeviceId is not set!')
		}

		const options: CoreOptions = {
			deviceId: protectString(this._deviceOptions.deviceId + 'LiveStatusGateway'),
			deviceToken: this._deviceOptions.deviceToken,

			deviceCategory: PeripheralDeviceCategory.LIVE_STATUS,
			deviceType: PeripheralDeviceType.LIVE_STATUS,

			deviceName: 'Live Status Gateway',
			watchDog: this._coreConfig ? this._coreConfig.watchdog : true,

			configManifest: LIVE_STATUS_DEVICE_CONFIG,
			documentationUrl: `https://nrkno.github.io/sofie-core/`,

			versions: this._getVersions(),
		}

		if (!options.deviceToken) {
			this.logger.warn('Token not set, only id! This might be unsecure!')
			options.deviceToken = 'unsecureToken'
		}

		return options
	}
	onConnected(fcn: () => any): void {
		this._onConnected = fcn
	}

	onDeviceChanged(id: PeripheralDeviceId): void {
		if (id !== this.core.deviceId) return
		const col = this.core.getCollection<PeripheralDeviceForDevice>('peripheralDeviceForDevice')
		if (!col) throw new Error('collection "peripheralDeviceForDevice" not found!')
		const device = col.findOne(id)

		this.deviceSettings = device?.deviceSettings || {}
		const logLevel = this.deviceSettings['debugLogging'] ? 'debug' : 'info'
		if (logLevel !== this.logger.level) {
			this.logger.level = logLevel

			for (const transport of this.logger.transports) {
				transport.level = logLevel
			}

			this.logger.info('Loglevel: ' + this.logger.level)
		}

		const studioId = device?.studioId
		if (studioId === undefined) {
			throw new Error(`Live status gateway must be attached to a studio`)
		}

		if (studioId !== this._studioId) {
			this._studioId = studioId
		}
	}

	get logDebug(): boolean {
		return !!this.deviceSettings['debugLogging']
	}

	get coreConnection(): CoreConnection {
		return this.core
	}

	get studioId(): StudioId | undefined {
		return this._studioId
	}

	executeFunction(cmd: PeripheralDeviceCommand, fcnObject: CoreHandler): void {
		if (cmd) {
			if (this._executedFunctions[unprotectString(cmd._id)]) return // prevent it from running multiple times

			// Ignore specific commands, to reduce noise:
			if (cmd.functionName !== 'getDebugStates') {
				this.logger.debug(`Executing function "${cmd.functionName}", args: ${JSON.stringify(cmd.args)}`)
			}

			this._executedFunctions[unprotectString(cmd._id)] = true
			const cb = (err: any, res?: any) => {
				if (err) {
					this.logger.error('executeFunction error', err, err.stack)
				}
				fcnObject.core.coreMethods.functionReply(cmd._id, err, res).catch((e) => {
					this.logger.error(e)
				})
			}
			// eslint-disable-next-line @typescript-eslint/ban-types
			const fcn: Function = fcnObject[cmd.functionName as keyof CoreHandler] as Function
			try {
				if (!fcn) throw Error(`Function "${cmd.functionName}" not found on device "${cmd.deviceId}"!`)

				Promise.resolve(fcn.apply(fcnObject, cmd.args))
					.then((result) => {
						cb(null, result)
					})
					.catch((e) => {
						cb(e.toString(), null)
					})
			} catch (e: any) {
				cb(e.toString(), null)
			}
		}
	}
	retireExecuteFunction(cmdId: string): void {
		delete this._executedFunctions[cmdId]
	}
	killProcess(actually: number): boolean {
		if (actually === 1) {
			this.logger.info('KillProcess command received, shutting down in 1000ms!')
			setTimeout(() => {
				// eslint-disable-next-line no-process-exit
				process.exit(0)
			}, 1000)
			return true
		}
		return false
	}
	pingResponse(message: string): void {
		this.core.setPingResponse(message)
	}
	getSnapshot(): any {
		this.logger.info('getSnapshot')
		return {}
	}
	getDevicesInfo(): any {
		this.logger.info('getDevicesInfo')
		return []
	}
	async updateCoreStatus(): Promise<any> {
		let statusCode = StatusCode.GOOD
		const messages: Array<string> = []

		if (!this._statusInitialized) {
			statusCode = StatusCode.BAD
			messages.push('Starting up...')
		}
		if (this._statusDestroyed) {
			statusCode = StatusCode.BAD
			messages.push('Shut down')
		}

		return this.core.setStatus({
			statusCode: statusCode,
			messages: messages,
		})
	}
	private _getVersions() {
		const versions: { [packageName: string]: string } = {}

		if (process.env.npm_package_version) {
			versions['_process'] = process.env.npm_package_version
		}

		return versions
	}
}

import {
	CoreConnection,
	CoreOptions,
	DDPConnectorOptions,
	PeripheralDeviceAPI,
	PeripheralDeviceCommand,
	protectString,
	StatusCode,
	unprotectString,
} from '@sofie-automation/server-core-integration'
import * as Winston from 'winston'

import { IMOSDevice } from '@mos-connection/connector'
import { MosHandler } from './mosHandler'
import { DeviceConfig } from './connector'
import { MOS_DEVICE_CONFIG_MANIFEST } from './configManifest'
import { getVersions } from './versions'
import { CoreMosDeviceHandler } from './CoreMosDeviceHandler'

export interface CoreConfig {
	host: string
	port: number
	watchdog: boolean
}
/**
 * Represents a connection between mos-integration and Core
 */
export class CoreHandler {
	core: CoreConnection | undefined
	logger: Winston.Logger
	public _observers: Array<any> = []
	private _deviceOptions: DeviceConfig
	private _coreMosHandlers: Array<CoreMosDeviceHandler> = []
	private _onConnected?: () => any
	private _subscriptions: Array<any> = []
	private _isInitialized = false
	private _executedFunctions: { [id: string]: boolean } = {}
	private _coreConfig?: CoreConfig
	private _certificates?: Buffer[]

	constructor(logger: Winston.Logger, deviceOptions: DeviceConfig) {
		this.logger = logger
		this._deviceOptions = deviceOptions
	}

	async init(config: CoreConfig, certificates: Buffer[]): Promise<void> {
		// this.logger.info('========')
		this._coreConfig = config
		this._certificates = certificates
		this.core = new CoreConnection(this.getCoreConnectionOptions())

		this.core.onConnected(() => {
			this.logger.info('Core Connected!')
			if (this._isInitialized) this.onConnectionRestored()
		})
		this.core.onDisconnected(() => {
			this.logger.info('Core Disconnected!')
		})
		this.core.onError((err) => {
			this.logger.error('Core Error: ' + (typeof err === 'string' ? err : err.message || err.toString()))
		})

		const ddpConfig: DDPConnectorOptions = {
			host: config.host,
			port: config.port,
		}
		if (this._certificates?.length) {
			ddpConfig.tlsOpts = {
				ca: this._certificates,
			}
		}
		await this.core.init(ddpConfig)

		if (!this.core) {
			throw Error('core is undefined!')
		}

		this.core
			.setStatus({
				statusCode: StatusCode.GOOD,
				// messages: []
			})
			.catch((e) => this.logger.warn('Error when setting status:' + e))
		// nothing

		await this.setupSubscriptionsAndObservers()

		this._isInitialized = true
	}
	async dispose(): Promise<void> {
		if (!this.core) {
			throw Error('core is undefined!')
		}

		await this.core.setStatus({
			statusCode: StatusCode.FATAL,
			messages: ['Shutting down'],
		})

		await Promise.all(
			this._coreMosHandlers.map(async (cmh: CoreMosDeviceHandler) => {
				return cmh.dispose()
			})
		)

		if (!this.core) {
			throw Error('core is undefined!')
		}

		await this.core.destroy()
	}
	private getCoreConnectionOptions(): CoreOptions {
		if (!this._deviceOptions.deviceId) {
			// this.logger.warn('DeviceId not set, using a temporary random id!')
			throw new Error('DeviceId is not set!')
		}

		const options: CoreOptions = {
			deviceId: protectString(this._deviceOptions.deviceId + 'MosCoreParent'),
			deviceToken: this._deviceOptions.deviceToken,

			deviceCategory: PeripheralDeviceAPI.PeripheralDeviceCategory.INGEST,
			deviceType: PeripheralDeviceAPI.PeripheralDeviceType.MOS,

			deviceName: 'MOS gateway',
			watchDog: this._coreConfig ? this._coreConfig.watchdog : true,

			configManifest: MOS_DEVICE_CONFIG_MANIFEST,

			versions: getVersions(this.logger),

			documentationUrl: 'https://github.com/nrkno/sofie-core',
		}

		if (!options.deviceToken) {
			this.logger.warn('Token not set, only id! This might be unsecure!')
			options.deviceToken = 'unsecureToken'
		}

		return options
	}
	async registerMosDevice(mosDevice: IMOSDevice, mosHandler: MosHandler): Promise<CoreMosDeviceHandler> {
		this.logger.info('registerMosDevice -------------')
		const coreMos = new CoreMosDeviceHandler(this, mosDevice, mosHandler)

		this._coreMosHandlers.push(coreMos)
		return coreMos.init().then(() => {
			this.logger.info('registerMosDevice done!')
			return coreMos
		})
	}
	async unRegisterMosDevice(mosDevice: IMOSDevice): Promise<void> {
		let foundI = -1
		for (let i = 0; i < this._coreMosHandlers.length; i++) {
			const cmh = this._coreMosHandlers[i]
			if (cmh._mosDevice.idPrimary === mosDevice.idSecondary) {
				foundI = i
				break
			}
		}
		const coreMosHandler = this._coreMosHandlers[foundI]
		if (coreMosHandler) {
			return coreMosHandler.dispose().then(() => {
				this._coreMosHandlers.splice(foundI, 1)
			})
		}
	}
	onConnectionRestored(): void {
		this.setupSubscriptionsAndObservers().catch((e) => {
			this.logger.error(e)
		})
		if (this._onConnected) this._onConnected()
		this._coreMosHandlers.forEach((cmh: CoreMosDeviceHandler) => {
			cmh.setupSubscriptionsAndObservers()
		})
	}
	onConnected(fcn: () => any): void {
		this._onConnected = fcn
	}
	async setupSubscriptionsAndObservers(): Promise<void> {
		// console.log('setupObservers', this.core.deviceId)
		if (this._observers.length) {
			this.logger.info('Core: Clearing observers..')
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}
		this._subscriptions = []

		if (!this.core) {
			throw Error('core is undefined!')
		}

		this.logger.info('Core: Setting up subscriptions for ' + this.core.deviceId + '..')
		const subs = await Promise.all([
			this.core.autoSubscribe('peripheralDeviceForDevice', this.core.deviceId),
			this.core.autoSubscribe('peripheralDeviceCommands', this.core.deviceId),
		])

		this._subscriptions = this._subscriptions.concat(subs)

		this.setupObserverForPeripheralDeviceCommands(this)
	}
	executeFunction(cmd: PeripheralDeviceCommand, fcnObject: CoreHandler | CoreMosDeviceHandler): void {
		if (cmd) {
			if (this._executedFunctions[unprotectString(cmd._id)]) return // prevent it from running multiple times
			this.logger.debug(cmd.functionName || cmd.actionId || '', cmd.args)
			this._executedFunctions[unprotectString(cmd._id)] = true
			// console.log('executeFunction', cmd)
			const cb = (err: any, res?: any) => {
				// console.log('cb', err, res)
				if (err) {
					this.logger.error('executeFunction error', err, err.stack)
				}

				if (!fcnObject.core) {
					throw Error('fcnObject.core is undefined!')
				}

				fcnObject.core.coreMethods
					.functionReply(cmd._id, err, res)
					.then(() => {
						// console.log('cb done')
					})
					.catch((e) => {
						this.logger.error(e)
					})
			}
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			const fcn = fcnObject[cmd.functionName]
			try {
				if (!fcn) throw Error('Function "' + cmd.functionName + '" not found!')

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
	setupObserverForPeripheralDeviceCommands(functionObject: CoreMosDeviceHandler | CoreHandler): void {
		if (!functionObject.core) {
			throw Error('functionObject.core is undefined!')
		}

		const observer = functionObject.core.observe('peripheralDeviceCommands')
		functionObject._observers.push(observer)
		const addedChangedCommand = (id: string) => {
			if (!functionObject.core) {
				throw Error('functionObject.core is undefined!')
			}

			const cmds = functionObject.core.getCollection<PeripheralDeviceCommand>('peripheralDeviceCommands')
			if (!cmds) throw Error('"peripheralDeviceCommands" collection not found!')
			const cmd = cmds.findOne(protectString(id))
			if (!cmd) throw Error('PeripheralCommand "' + id + '" not found!')
			// console.log('addedChangedCommand', id)
			if (cmd.deviceId === functionObject.core.deviceId) {
				this.executeFunction(cmd, functionObject)
			} else {
				// console.log('not mine', cmd.deviceId, this.core.deviceId)
			}
		}
		observer.added = (id: string) => {
			addedChangedCommand(id)
		}
		observer.changed = (id: string) => {
			addedChangedCommand(id)
		}
		observer.removed = (id: string) => {
			this.retireExecuteFunction(id)
		}
		const cmds = functionObject.core.getCollection<PeripheralDeviceCommand>('peripheralDeviceCommands')
		if (!cmds) throw Error('"peripheralDeviceCommands" collection not found!')
		// any should be PeripheralDeviceCommand
		cmds.find({}).forEach((cmd) => {
			if (!functionObject.core) {
				throw Error('functionObject.core is undefined!')
			}
			if (cmd.deviceId === functionObject.core.deviceId) {
				this.executeFunction(cmd, functionObject)
			}
		})
	}
	killProcess(): void {
		this.logger.info('KillProcess command received, shutting down in 1000ms!')
		setTimeout(() => {
			// eslint-disable-next-line no-process-exit
			process.exit(0)
		}, 1000)
	}
	pingResponse(message: string): true {
		if (!this.core) {
			throw Error('core is undefined!')
		}
		this.core.setPingResponse(message)
		return true
	}
	getSnapshot(): any {
		this.logger.info('getSnapshot')
		return {} // TODO: send some snapshot data?
	}
}

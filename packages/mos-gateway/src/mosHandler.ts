import {
	MosConnection,
	IMOSDevice,
	IMOSConnectionStatus,
	IMOSRunningOrder,
	IMOSROAck,
	MosString128,
	IMOSRunningOrderBase,
	IMOSRunningOrderStatus,
	IMOSStoryStatus,
	IMOSItemStatus,
	IMOSStoryAction,
	IMOSROStory,
	IMOSROAction,
	IMOSItemAction,
	IMOSItem,
	IMOSROReadyToAir,
	IMOSROFullStory,
	IConnectionConfig,
	IMOSDeviceConnectionOptions,
	MosDevice,
	IMOSListMachInfo,
} from 'mos-connection'
import * as Winston from 'winston'
import { CoreHandler, CoreMosDeviceHandler } from './coreHandler'
import { CollectionObj } from '@sofie-automation/server-core-integration'
import { literal } from './lib'

// export interface MosOptions {
// 	mosID: string,
// 	acceptsConnections: boolean,
// 	profiles: {
// 		'0': boolean,
// 		'1': boolean,
// 		'2': boolean,
// 		'3': boolean,
// 		'4': boolean,
// 		'5': boolean,
// 		'6': boolean,
// 		'7': boolean
// 	}
// }
export interface MosConfig {
	self: IConnectionConfig
	// devices: Array<IMOSDeviceConnectionOptions>
}
export interface MosDeviceSettings {
	mosId: string
	devices: {
		[deviceId: string]: MosDeviceSettingsDevice
	}
	debugLogging: boolean
}
export interface MosDeviceSettingsDevice {
	primary: MosDeviceSettingsDeviceOptions
	secondary?: MosDeviceSettingsDeviceOptions
}
export interface MosDeviceSettingsDeviceOptions {
	id: string
	host: string
	timeout?: number
}

export class MosHandler {
	public mos: MosConnection

	public mosOptions: MosConfig
	public debugLogging = false

	private allMosDevices: { [id: string]: { mosDevice: IMOSDevice; coreMosHandler?: CoreMosDeviceHandler } } = {}
	private _ownMosDevices: { [deviceId: string]: MosDevice } = {}
	private _logger: Winston.LoggerInstance
	private _disposed = false
	private _settings?: MosDeviceSettings
	private _coreHandler: CoreHandler
	private _observers: Array<any> = []
	private _triggerupdateDevicesTimeout: any = null

	constructor(logger: Winston.LoggerInstance) {
		this._logger = logger
	}
	async init(config: MosConfig, coreHandler: CoreHandler): Promise<void> {
		this.mosOptions = config
		this._coreHandler = coreHandler

		const peripheralDevice = await coreHandler.core.getPeripheralDevice()

		this._settings = peripheralDevice.settings || {}

		await this._initMosConnection()

		this._coreHandler.onConnected(() => {
			// This is called whenever a connection to Core has been (re-)established
			this.setupObservers()
			this.sendStatusOfAllMosDevices()
		})
		this.setupObservers()

		await this._updateDevices()

		// All connections have been made at this point
	}
	async dispose(): Promise<void> {
		this._disposed = true
		await this.mos?.dispose()
	}
	setupObservers(): void {
		if (this._observers.length) {
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}
		this._logger.info('Renewing observers')

		const deviceObserver = this._coreHandler.core.observe('peripheralDevices')
		deviceObserver.added = () => {
			this._deviceOptionsChanged()
		}
		deviceObserver.changed = () => {
			this._deviceOptionsChanged()
		}
		deviceObserver.removed = () => {
			this._deviceOptionsChanged()
		}
		this._observers.push(deviceObserver)

		this._deviceOptionsChanged()
	}
	// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
	debugLog(msg: any, ...args: any[]): void {
		if (this.debugLogging) {
			this._logger.debug(msg, ...args)
		}
	}
	private _deviceOptionsChanged() {
		const peripheralDevice = this.getThisPeripheralDevice()
		if (peripheralDevice) {
			const settings: MosDeviceSettings = peripheralDevice.settings || {}
			if (this.debugLogging !== settings.debugLogging) {
				this._logger.info('Changing debugLogging to ' + settings.debugLogging)

				this.debugLogging = settings.debugLogging

				this.mos.setDebug(settings.debugLogging)

				if (settings.debugLogging) {
					this._logger.level = 'debug'
				} else {
					this._logger.level = 'info'
				}
				this._logger.info('log level ' + this._logger.level)
				this._logger.info('test log info')
				console.log('test console.log')
				this._logger.debug('test log debug')
			}
		}
		if (this._triggerupdateDevicesTimeout) {
			clearTimeout(this._triggerupdateDevicesTimeout)
		}
		this._triggerupdateDevicesTimeout = setTimeout(() => {
			this._updateDevices().catch((e) => {
				this._logger.error(e)
			})
		}, 20)
	}
	private async _initMosConnection(): Promise<void> {
		if (this._disposed) return Promise.resolve()
		if (!this._settings) throw Error('Mos-Settings are not set')

		this._logger.info('Initializing MosConnection...')

		const connectionConfig: IConnectionConfig = this.mosOptions.self

		if (!this._settings.mosId) throw Error('mosId missing in settings!')
		connectionConfig.mosID = this._settings.mosId

		this.mos = new MosConnection(connectionConfig)
		this.mos.on('rawMessage', (source, type, message) => {
			this.debugLog('rawMessage', source, type, message)
			// this._logger.debug('rawMessage', source, type, message)
		})
		this.mos.on('info', (message: any) => {
			this._logger.info(message)
		})
		this.mos.on('error', (error: any) => {
			this._logger.error(error)
		})
		this.mos.on('warning', (warning: any) => {
			this._logger.error(warning)
		})

		this.mos.onConnection((mosDevice: IMOSDevice) => {
			// a new connection to a device has been made
			this._logger.info('new mosConnection established: ' + mosDevice.idPrimary + ', ' + mosDevice.idSecondary)

			this.allMosDevices[mosDevice.idPrimary] = { mosDevice: mosDevice }

			return this._coreHandler
				.registerMosDevice(mosDevice, this)
				.then((coreMosHandler) => {
					// this._logger.info('mosDevice registered -------------')
					// Setup message flow between the devices:

					this.allMosDevices[mosDevice.idPrimary].coreMosHandler = coreMosHandler

					// Initial Status check:
					const connectionStatus = mosDevice.getConnectionStatus()
					coreMosHandler.onMosConnectionChanged(connectionStatus) // initial check
					// Profile 0: -------------------------------------------------
					mosDevice.onConnectionChange((connectionStatus: IMOSConnectionStatus) => {
						//  MOSDevice >>>> Core
						coreMosHandler.onMosConnectionChanged(connectionStatus)
					})
					coreMosHandler.onMosConnectionChanged(mosDevice.getConnectionStatus())
					mosDevice.onRequestMachineInfo(() => {
						// MOSDevice >>>> Core
						return coreMosHandler.getMachineInfo()
					})

					// Profile 1: -------------------------------------------------
					/*
				mosDevice.onRequestMOSObject((objId: string) => {
					// coreMosHandler.fetchMosObject(objId)
					// return Promise<IMOSObject | null>
				})
				*/
					// onRequestMOSObject: (cb: (objId: string) => Promise<IMOSObject | null>) => void
					// onRequestAllMOSObjects: (cb: () => Promise<Array<IMOSObject>>) => void
					// getMOSObject: (objId: string) => Promise<IMOSObject>
					// getAllMOSObjects: () => Promise<Array<IMOSObject>>
					// Profile 2: -------------------------------------------------
					mosDevice.onCreateRunningOrder((ro: IMOSRunningOrder) => {
						// MOSDevice >>>> Core
						return this._getROAck(ro.ID, coreMosHandler.mosRoCreate(ro))
					})
					mosDevice.onReplaceRunningOrder((ro: IMOSRunningOrder) => {
						// MOSDevice >>>> Core
						return this._getROAck(ro.ID, coreMosHandler.mosRoReplace(ro))
					})
					mosDevice.onDeleteRunningOrder((runningOrderId: MosString128) => {
						// MOSDevice >>>> Core
						return this._getROAck(runningOrderId, coreMosHandler.mosRoDelete(runningOrderId))
					})
					mosDevice.onMetadataReplace((ro: IMOSRunningOrderBase) => {
						// MOSDevice >>>> Core
						return this._getROAck(ro.ID, coreMosHandler.mosRoMetadata(ro))
					})
					mosDevice.onRunningOrderStatus((status: IMOSRunningOrderStatus) => {
						// MOSDevice >>>> Core
						return this._getROAck(status.ID, coreMosHandler.mosRoStatus(status))
					})
					mosDevice.onStoryStatus((status: IMOSStoryStatus) => {
						// MOSDevice >>>> Core
						return this._getROAck(status.RunningOrderId, coreMosHandler.mosRoStoryStatus(status))
					})
					mosDevice.onItemStatus((status: IMOSItemStatus) => {
						// MOSDevice >>>> Core
						return this._getROAck(status.RunningOrderId, coreMosHandler.mosRoItemStatus(status))
					})
					mosDevice.onROInsertStories((Action: IMOSStoryAction, Stories: Array<IMOSROStory>) => {
						// MOSDevice >>>> Core
						return this._getROAck(Action.RunningOrderID, coreMosHandler.mosRoStoryInsert(Action, Stories))
					})
					mosDevice.onROInsertItems((Action: IMOSItemAction, Items: Array<IMOSItem>) => {
						// MOSDevice >>>> Core
						return this._getROAck(Action.RunningOrderID, coreMosHandler.mosRoItemInsert(Action, Items))
					})
					mosDevice.onROReplaceStories((Action: IMOSStoryAction, Stories: Array<IMOSROStory>) => {
						// MOSDevice >>>> Core
						return this._getROAck(Action.RunningOrderID, coreMosHandler.mosRoStoryReplace(Action, Stories))
					})
					mosDevice.onROReplaceItems((Action: IMOSItemAction, Items: Array<IMOSItem>) => {
						// MOSDevice >>>> Core
						return this._getROAck(Action.RunningOrderID, coreMosHandler.mosRoItemReplace(Action, Items))
					})
					mosDevice.onROMoveStories((Action: IMOSStoryAction, Stories: Array<MosString128>) => {
						// MOSDevice >>>> Core
						return this._getROAck(Action.RunningOrderID, coreMosHandler.mosRoStoryMove(Action, Stories))
					})
					mosDevice.onROMoveItems((Action: IMOSItemAction, Items: Array<MosString128>) => {
						// MOSDevice >>>> Core
						return this._getROAck(Action.RunningOrderID, coreMosHandler.mosRoItemMove(Action, Items))
					})
					mosDevice.onRODeleteStories((Action: IMOSROAction, Stories: Array<MosString128>) => {
						// MOSDevice >>>> Core
						return this._getROAck(Action.RunningOrderID, coreMosHandler.mosRoStoryDelete(Action, Stories))
					})
					mosDevice.onRODeleteItems((Action: IMOSStoryAction, Items: Array<MosString128>) => {
						// MOSDevice >>>> Core
						return this._getROAck(Action.RunningOrderID, coreMosHandler.mosRoItemDelete(Action, Items))
					})
					mosDevice.onROSwapStories(
						(Action: IMOSROAction, StoryID0: MosString128, StoryID1: MosString128) => {
							// MOSDevice >>>> Core
							return this._getROAck(
								Action.RunningOrderID,
								coreMosHandler.mosRoStorySwap(Action, StoryID0, StoryID1)
							)
						}
					)
					mosDevice.onROSwapItems((Action: IMOSStoryAction, ItemID0: MosString128, ItemID1: MosString128) => {
						// MOSDevice >>>> Core
						return this._getROAck(
							Action.RunningOrderID,
							coreMosHandler.mosRoItemSwap(Action, ItemID0, ItemID1)
						)
					})
					mosDevice.onReadyToAir((Action: IMOSROReadyToAir) => {
						// MOSDevice >>>> Core
						return this._getROAck(Action.ID, coreMosHandler.mosRoReadyToAir(Action))
					})
					// ----------------------------------------------------------------
					// Init actions
					/*
				mosDevice.getMachineInfo()
					.then((machineInfo: IMOSListMachInfo) => {
					})
				*/
					// Profile 3: -------------------------------------------------
					// Profile 4: -------------------------------------------------
					// onStory: (cb: (story: IMOSROFullStory) => Promise<any>) => void
					mosDevice.onRunningOrderStory((story: IMOSROFullStory) => {
						// MOSDevice >>>> Core
						return this._getROAck(story.RunningOrderId, coreMosHandler.mosRoFullStory(story))
					})
				})
				.catch((e) => {
					this._logger.error('Error:', e)
				})
		})

		// Open mos-server for connections:
		await this.mos.init()
	}
	private sendStatusOfAllMosDevices() {
		// Send an update to Core of the status of all mos devices
		for (const handler of Object.values(this.allMosDevices)) {
			if (handler.coreMosHandler) {
				handler.coreMosHandler.onMosConnectionChanged(handler.mosDevice.getConnectionStatus())
			}
		}
	}
	private getThisPeripheralDevice(): CollectionObj | undefined {
		const peripheralDevices = this._coreHandler.core.getCollection('peripheralDevices')
		return peripheralDevices.findOne(this._coreHandler.core.deviceId)
	}
	private async _updateDevices(): Promise<void> {
		if (this._disposed) return Promise.resolve()
		if (!this.mos) await this._initMosConnection()

		const peripheralDevice = this.getThisPeripheralDevice()

		if (peripheralDevice) {
			const settings: MosDeviceSettings = peripheralDevice.settings || {}

			const devices = settings.devices || {}

			const devicesToAdd: { [id: string]: MosDeviceSettingsDevice } = {}
			const devicesToRemove: { [id: string]: true } = {}

			for (const [deviceId, device] of Object.entries(devices)) {
				if (device) {
					if (device.secondary) {
						// If the host isn't set, don't use secondary:
						if (!device.secondary.host || !device.secondary.id) delete device.secondary
					}

					const oldDevice: MosDevice | undefined = this._getDevice(deviceId)

					if (!oldDevice) {
						this._logger.info('Initializing new device: ' + deviceId)
						devicesToAdd[deviceId] = device
					} else {
						if (
							(oldDevice.primaryId || '') !== device.primary.id ||
							(oldDevice.primaryHost || '') !== device.primary.host ||
							(oldDevice.secondaryId || '') !== ((device.secondary || { id: '' }).id || '') ||
							(oldDevice.secondaryHost || '') !== ((device.secondary || { host: '' }).host || '')
						) {
							this._logger.info('Re-initializing device: ' + deviceId)
							devicesToRemove[deviceId] = true
							devicesToAdd[deviceId] = device
						}
					}
				}
			}
			for (const deviceId of Object.keys(this._ownMosDevices)) {
				if (!devices[deviceId]) {
					this._logger.info('Un-initializing device: ' + deviceId)
					devicesToRemove[deviceId] = true
				}
			}

			for (const deviceId of Object.keys(devicesToRemove)) {
				await this._removeDevice(deviceId)
			}
			for (const [deviceId, device] of Object.entries(devicesToAdd)) {
				await this._addDevice(deviceId, device)
			}
		}
	}
	private async _addDevice(deviceId: string, deviceOptions: IMOSDeviceConnectionOptions): Promise<void> {
		if (this._getDevice(deviceId)) {
			// the device is already there
			throw new Error(`Unable to add device "${deviceId}", because it already exists!`)
		}

		if (!deviceOptions.primary) throw new Error(`Options property "primary" not set`)
		const mosDevice: MosDevice = await this.mos.connect(deviceOptions)
		this._ownMosDevices[deviceId] = mosDevice

		try {
			const machInfo = await this._getMachineInfoUntilConnected(mosDevice)
			this._logger.info('Connected to Mos-device', machInfo)
			const machineId: string | undefined = machInfo.ID && machInfo.ID.toString()
			if (
				!(
					machineId === deviceOptions.primary.id ||
					(deviceOptions.secondary && machineId === deviceOptions.secondary.id)
				)
			) {
				throw new Error(
					`Mos-device has ID "${machineId}" but specified ncs-id is "${
						deviceOptions.primary.id || (deviceOptions.secondary || { id: '' }).id
					}"`
				)
			}
		} catch (e) {
			// something went wrong during init:
			await this.mos.disposeMosDevice(mosDevice)
			throw e
		}
	}
	private async _removeDevice(deviceId: string): Promise<void> {
		const mosDevice = this._getDevice(deviceId)

		delete this._ownMosDevices[deviceId]
		if (mosDevice) {
			const mosDevice0 =
				this.mos.getDevice(mosDevice.idPrimary) ||
				(mosDevice.idSecondary && this.mos.getDevice(mosDevice.idSecondary))

			if (mosDevice0) {
				await this.mos.disposeMosDevice(mosDevice)

				await this._coreHandler.unRegisterMosDevice(mosDevice)

				delete this._ownMosDevices[mosDevice.idPrimary]
				if (mosDevice.idSecondary) delete this._ownMosDevices[mosDevice.idSecondary]
			} else {
				// device not found in mosConnection
			}
		} else {
			// no device found
		}
	}
	private _getDevice(deviceId: string): MosDevice | undefined {
		return this._ownMosDevices[deviceId]
	}
	private async _getROAck(roId: MosString128, p: Promise<IMOSROAck>) {
		try {
			await p

			return literal<IMOSROAck>({
				ID: roId,
				Status: new MosString128('OK'),
				Stories: [], // Array<IMOSROAckStory> // todo: implement this later (?) (unknown if we really need to)
			})
		} catch (err) {
			this._logger.error('ROAck error:', err)
			return literal<IMOSROAck>({
				ID: roId,
				Status: new MosString128('Error: ' + err.toString()),
				Stories: [], // Array<IMOSROAckStory> // todo: implement this later (?) (unknown if we really need to)
			})
		}
	}
	private _getMachineInfoUntilConnected = async (mosDevice: MosDevice, triesLeft = 10) => {
		if (triesLeft <= 0) throw new Error('Unable to get MachineInfo')

		return new Promise<IMOSListMachInfo>((resolve, reject) => {
			mosDevice
				.requestMachineInfo()
				.then(resolve)
				.catch((e: any) => {
					if (e && (e + '').match(/failover/i)) {
						// TODO: workaround (mos.connect resolves too soon, before the connection is actually initialted)
						setTimeout(() => {
							this._getMachineInfoUntilConnected(mosDevice, triesLeft - 1)
								.then(resolve)
								.catch(reject)
						}, 2000)
					} else {
						reject(e)
					}
				})
		})
	}
}

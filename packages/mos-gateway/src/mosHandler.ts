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
	IMOSListMachInfo
} from 'mos-connection'
import * as _ from 'underscore'
import * as Winston from 'winston'
import { CoreHandler, CoreMosDeviceHandler } from './coreHandler'
import { CollectionObj } from '@sofie-automation/server-core-integration'

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
	public debugLogging: boolean = false

	private allMosDevices: { [id: string]: { mosDevice: IMOSDevice; coreMosHandler?: CoreMosDeviceHandler } } = {}
	private _ownMosDevices: { [deviceId: string]: MosDevice } = {}
	private _logger: Winston.Logger
	private _disposed: boolean = false
	private _settings?: MosDeviceSettings
	private _coreHandler: CoreHandler
	private _observers: Array<any> = []
	private _triggerupdateDevicesTimeout: any = null

	constructor (logger: Winston.Logger) {
		this._logger = logger
	}
	init (config: MosConfig, coreHandler: CoreHandler): Promise<void> {
		this.mosOptions = config
		this._coreHandler = coreHandler
		/*{
			mosID: 'seff-tv-automation',
			acceptsConnections: true, // default:true
			// accepsConnectionsFrom: ['127.0.0.1'],
			profiles: {
				'0': true,
				'1': true,
				'2': true,
				'3': false,
				'4': false,
				'5': false,
				'6': false,
				'7': false
			}
		}
		*/

		return (
			coreHandler.core
				.getPeripheralDevice()
				.then((peripheralDevice: any) => {
					this._settings = peripheralDevice.settings || {}

					return this._initMosConnection()
				})
				.then(() => {
					this._coreHandler.onConnected(() => {
						// This is called whenever a connection to Core has been (re-)established
						this.setupObservers()
						this.sendStatusOfAllMosDevices()
					})
					this.setupObservers()

					return this._updateDevices()
				})
				// .then(() => {
				// Connect to ENPS:
				// return Promise.all(
				// _.map((this._settings || {devices: {}}).devices, (device, deviceId: string) => {
				// })
				// )
				// })
				.then(() => {
					// All connections have been made at this point
				})
		)
	}
	dispose (): Promise<void> {
		this._disposed = true
		if (this.mos) {
			return this.mos.dispose()
		} else {
			return Promise.resolve()
		}
	}
	setupObservers () {
		if (this._observers.length) {
			this._observers.forEach((obs) => {
				obs.stop()
			})
			this._observers = []
		}
		this._logger.info('Renewing observers')

		// let timelineObserver = this._coreHandler.core.observe('timeline')
		// timelineObserver.added = () => { this._triggerupdateTimeline() }
		// timelineObserver.changed = () => { this._triggerupdateTimeline() }
		// timelineObserver.removed = () => { this._triggerupdateTimeline() }
		// this._observers.push(timelineObserver)

		// let mappingsObserver = this._coreHandler.core.observe('studioInstallation')
		// mappingsObserver.added = () => { this._triggerupdateMapping() }
		// mappingsObserver.changed = () => { this._triggerupdateMapping() }
		// mappingsObserver.removed = () => { this._triggerupdateMapping() }
		// this._observers.push(mappingsObserver)

		let deviceObserver = this._coreHandler.core.observe('peripheralDevices')
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
	debugLog (msg: any, ...args: any[]) {
		if (this.debugLogging) {
			this._logger.debug(msg, ...args)
		}
	}
	private _deviceOptionsChanged () {
		let peripheralDevice = this.getThisPeripheralDevice()
		if (peripheralDevice) {
			let settings: MosDeviceSettings = peripheralDevice.settings || {}
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
	private _initMosConnection (): Promise<void> {
		if (this._disposed) return Promise.resolve()
		if (!this._settings) throw Error('Mos-Settings are not set')

		this._logger.info('Initializing MosConnection...')

		let connectionConfig: IConnectionConfig = this.mosOptions.self

		if (!this._settings.mosId) throw Error('mosId missing in settings!')
		connectionConfig.mosID = this._settings.mosId

		this.mos = new MosConnection(connectionConfig)
		this.mos.on('rawMessage', (source, type, message) => {
			// Filter out heartbeat messages, to reduce log amount:
			if (`${message}`.indexOf('<heartbeat') >= 0) {
				return
			}
			this.debugLog('rawMessage', source, type, message)
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
					let connectionStatus = mosDevice.getConnectionStatus()
					coreMosHandler.onMosConnectionChanged(connectionStatus) // initial check
					// Profile 0: -------------------------------------------------
					mosDevice.onConnectionChange((newStatus: IMOSConnectionStatus) => {
						//  MOSDevice >>>> Core
						coreMosHandler.onMosConnectionChanged(newStatus)
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
		return this.mos.init().then(() => {
			return
		})
	}
	private sendStatusOfAllMosDevices () {
		// Send an update to Core of the status of all mos devices
		for (const handler of Object.values(this.allMosDevices)) {
			if (handler.coreMosHandler) {
				handler.coreMosHandler.onMosConnectionChanged(handler.mosDevice.getConnectionStatus())
			}
		}
	}
	private getThisPeripheralDevice (): CollectionObj | undefined {
		let peripheralDevices = this._coreHandler.core.getCollection('peripheralDevices')
		return peripheralDevices.findOne(this._coreHandler.core.deviceId)
	}
	private _updateDevices (): Promise<void> {
		if (this._disposed) return Promise.resolve()
		return (!this.mos ? this._initMosConnection() : Promise.resolve())
			.then(() => {
				let peripheralDevice = this.getThisPeripheralDevice()

				if (peripheralDevice) {
					let settings: MosDeviceSettings = peripheralDevice.settings || {}

					let devices = settings.devices

					let devicesToAdd: { [id: string]: MosDeviceSettingsDevice } = {}
					let devicesToRemove: { [id: string]: true } = {}

					_.each(devices, (device, deviceId: string) => {
						if (device) {
							if (device.secondary) {
								// If the host isn't set, don't use secondary:
								if (!device.secondary.host || !device.secondary.id) delete device.secondary
							}

							let oldDevice: MosDevice | null = this._getDevice(deviceId)

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
					})

					_.each(this._ownMosDevices, (oldDevice: MosDevice, deviceId: string) => {
						if (oldDevice && !devices[deviceId]) {
							this._logger.info('Un-initializing device: ' + deviceId)
							devicesToRemove[deviceId] = true
						}
					})

					return Promise.all(
						_.map(devicesToRemove, (_val, deviceId) => {
							return this._removeDevice(deviceId)
						})
					)
						.then(() => {
							return Promise.all(
								_.map(devicesToAdd, (device, deviceId) => {
									return this._addDevice(deviceId, device)
								})
							)
						})
						.then(() => {
							return
						})
				}
				return Promise.resolve()
			})
			.then(() => {
				return
			})
	}
	private _addDevice (deviceId: string, deviceOptions: IMOSDeviceConnectionOptions): Promise<MosDevice> {
		if (this._getDevice(deviceId)) {
			// the device is already there
			throw new Error('Unable to add device "' + deviceId + '", because it already exists!')
		}

		return this.mos.connect(deviceOptions).then((mosDevice: MosDevice) => {
			// called when a connection has been made

			this._ownMosDevices[deviceId] = mosDevice

			const getMachineInfoUntilConnected = () =>
				mosDevice.requestMachineInfo().catch((e: any) => {
					if (
						e &&
						((e + '').match(/no connection available for failover/i) ||
							(e + '').match(/failover connection/i))
					) {
						// TODO: workaround (mos.connect resolves too soon, before the connection is actually initialted)
						return new Promise((resolve) => {
							setTimeout(() => {
								resolve(getMachineInfoUntilConnected())
							}, 2000)
						})
					} else {
						throw e
					}
				})

			return getMachineInfoUntilConnected()
				.then((machInfo: IMOSListMachInfo) => {
					this._logger.info('Connected to Mos-device', machInfo)
					let machineId: string | undefined = machInfo.ID && machInfo.ID.toString()
					if (
						!(
							machineId === deviceOptions.primary.id ||
							(deviceOptions.secondary && machineId === deviceOptions.secondary.id)
						)
					) {
						throw new Error(
							'Mos-device has ID "' +
								machineId +
								'" but specified ncs-id is "' +
								(deviceOptions.primary.id || (deviceOptions.secondary || { id: '' }).id) +
								'"'
						)
					}
					return mosDevice
				})
				.catch((e) => {
					// something went wrong during init:
					this.mos.disposeMosDevice(mosDevice).catch(() => {
						this._logger.error(e)
					})
					throw e
				})
		})
	}
	private _removeDevice (deviceId: string): Promise<void> {
		// let mosDevice = this.mos.getDevice(deviceId)
		let mosDevice = this._getDevice(deviceId) as MosDevice

		delete this._ownMosDevices[deviceId]
		if (mosDevice) {
			let mosDevice0 =
				this.mos.getDevice(mosDevice.idPrimary) ||
				(mosDevice.idSecondary && this.mos.getDevice(mosDevice.idSecondary))

			if (mosDevice0) {
				return this.mos
					.disposeMosDevice(mosDevice)
					.then(() => {
						return this._coreHandler.unRegisterMosDevice(mosDevice)
					})
					.then(() => {
						delete this._ownMosDevices[mosDevice.idPrimary]
						if (mosDevice.idSecondary) delete this._ownMosDevices[mosDevice.idSecondary]
					})
					.catch((e) => {
						throw new Error(e)
					})
			} else {
				// device not found in mosConnection
			}
		} else {
			// no device found
		}
		return Promise.resolve()
	}
	private _getDevice (deviceId: string): MosDevice | null {
		return this._ownMosDevices[deviceId] || null
	}
	private _getROAck (roId: MosString128, p: Promise<IMOSROAck>) {
		return p
			.then(() => {
				let roAck: IMOSROAck = {
					ID: roId,
					Status: new MosString128('OK'),
					Stories: [] // Array<IMOSROAckStory> // todo: implement this later (?) (unknown if we really need to)
				}
				return roAck
			})
			.catch((err) => {
				this._logger.error('ROAck error:', err)
				let roAck: IMOSROAck = {
					ID: roId,
					Status: new MosString128('Error: ' + err.toString()),
					Stories: [] // Array<IMOSROAckStory> // todo: implement this later (?) (unknown if we really need to)
				}
				return roAck
			})
	}
}

import { MosHandler, MosConfig } from './mosHandler'
import { CoreHandler, CoreConfig } from './coreHandler'
import * as Winston from 'winston'
import { Process } from './process'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'

export interface Config {
	process: ProcessConfig
	device: DeviceConfig
	core: CoreConfig
	mos: MosConfig
}
export interface ProcessConfig {
	/** Will cause the Node applocation to blindly accept all certificates. Not recommenced unless in local, controlled networks. */
	unsafeSSL: boolean
	/** Paths to certificates to load, for SSL-connections */
	certificates: string[]
}
export interface DeviceConfig {
	deviceId: PeripheralDeviceId
	deviceToken: string
}
export class Connector {
	private mosHandler: MosHandler | undefined
	private coreHandler: CoreHandler | undefined
	private _config: Config | undefined
	private _logger: Winston.Logger
	private _process: Process | undefined

	constructor(logger: Winston.Logger) {
		this._logger = logger
	}

	async init(config: Config): Promise<void> {
		this._config = config

		return Promise.resolve()
			.then(() => {
				this._logger.info('Initializing Process...')
				return this.initProcess()
			})
			.then(async () => {
				this._logger.info('Process initialized')
				this._logger.info('Initializing Core...')
				return this.initCore()
			})
			.then(async () => {
				this._logger.info('Initializing Mos...')
				return this.initMos()
			})
			.then(() => {
				this._logger.info('Initialization done')
				return
			})
			.catch((e) => {
				this._logger.error('Error during initialization:', e, e.stack)

				this._logger.info('Shutting down in 10 seconds!')

				this.dispose().catch((e2) => this._logger.error(e2))

				setTimeout(() => {
					// eslint-disable-next-line no-process-exit
					process.exit(0)
				}, 10 * 1000)

				return
			})
	}
	initProcess(): void {
		this._process = new Process(this._logger)

		if (!this._config) {
			throw Error('_config is undefined!')
		}

		this._process.init(this._config.process)
	}
	async initCore(): Promise<void> {
		if (!this._config) {
			throw Error('_config is undefined!')
		}

		this.coreHandler = new CoreHandler(this._logger, this._config.device)

		if (!this.coreHandler) {
			throw Error('coreHandler is undefined!')
		}

		if (!this._process) {
			throw Error('_process is undefined!')
		}

		return this.coreHandler.init(this._config.core, this._process)
	}
	async initMos(): Promise<void> {
		this.mosHandler = new MosHandler(this._logger)

		if (!this._config) {
			throw Error('_config is undefined!')
		}

		if (!this.coreHandler) {
			throw Error('coreHandler is undefined!')
		}

		return this.mosHandler.init(this._config.mos, this.coreHandler)
	}
	async dispose(): Promise<void> {
		return (this.mosHandler ? this.mosHandler.dispose() : Promise.resolve())
			.then(async () => {
				return this.coreHandler ? this.coreHandler.dispose() : Promise.resolve()
			})
			.then(() => {
				return
			})
	}
}

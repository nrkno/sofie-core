import { MosHandler, MosConfig } from './mosHandler'
import { CoreHandler, CoreConfig } from './coreHandler'
import * as Winston from 'winston'
import { Process } from './process'

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
	deviceId: string
	deviceToken: string
}
export class Connector {
	private mosHandler: MosHandler
	private coreHandler: CoreHandler
	private _config: Config
	private _logger: Winston.Logger
	private _process: Process

	constructor (logger: Winston.Logger) {
		this._logger = logger
	}

	init (config: Config): Promise<void> {
		this._config = config

		return Promise.resolve()
			.then(() => {
				this._logger.info('Initializing Process...')
				return this.initProcess()
			})
			.then(() => {
				this._logger.info('Process initialized')
				this._logger.info('Initializing Core...')
				return this.initCore()
			})
			.then(() => {
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
					process.exit(0)
				}, 10 * 1000)

				return
			})
	}
	initProcess () {
		this._process = new Process(this._logger)
		this._process.init(this._config.process)
	}
	initCore () {
		this.coreHandler = new CoreHandler(this._logger, this._config.device)
		return this.coreHandler.init(this._config.core, this._process)
	}
	initMos (): Promise<void> {
		this.mosHandler = new MosHandler(this._logger)
		return this.mosHandler.init(this._config.mos, this.coreHandler)
	}
	dispose (): Promise<void> {
		return (this.mosHandler ? this.mosHandler.dispose() : Promise.resolve())
			.then(() => {
				return this.coreHandler ? this.coreHandler.dispose() : Promise.resolve()
			})
			.then(() => {
				return
			})
	}
}

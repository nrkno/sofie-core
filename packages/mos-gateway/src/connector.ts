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
	private _logger: Winston.LoggerInstance
	private _process: Process

	constructor(logger: Winston.LoggerInstance) {
		this._logger = logger
	}

	async init(config: Config): Promise<void> {
		this._config = config

		try {
			this._logger.info('Initializing Process...')
			await this.initProcess()

			this._logger.info('Process initialized')
			this._logger.info('Initializing Core...')
			await this.initCore()

			this._logger.info('Initializing Mos...')
			await this.initMos()

			this._logger.info('Initialization done')
		} catch (e) {
			this._logger.error('Error during initialization:', e, e.stack)
			// this._logger.error(e)
			// this._logger.error(e.stack)

			this._logger.info('Shutting down in 10 seconds!')
			setTimeout(() => {
				// eslint-disable-next-line no-process-exit
				process.exit(0)
			}, 10 * 1000)

			this.dispose(`Error during startup: ${e}`)
		}
	}
	initProcess(): void {
		this._process = new Process(this._logger)
		this._process.init(this._config.process)
	}
	initCore(): Promise<void> {
		this.coreHandler = new CoreHandler(this._logger, this._config.device)
		return this.coreHandler.init(this._config.core, this._process)
	}
	initMos(): Promise<void> {
		this.mosHandler = new MosHandler(this._logger)
		return this.mosHandler.init(this._config.mos, this.coreHandler)
	}
	async dispose(reason?: string): Promise<void> {
		await this.mosHandler?.dispose()
		await this.coreHandler?.dispose(reason)
	}
}

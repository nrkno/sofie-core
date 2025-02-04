import { MosHandler, MosConfig } from './mosHandler'
import { CoreHandler, CoreConfig } from './coreHandler'
import * as Winston from 'winston'
import {
	PeripheralDeviceId,
	loadCertificatesFromDisk,
	CertificatesConfig,
	stringifyError,
} from '@sofie-automation/server-core-integration'

export interface Config {
	certificates: CertificatesConfig
	device: DeviceConfig
	core: CoreConfig
	mos: MosConfig
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

	constructor(logger: Winston.Logger) {
		this._logger = logger
	}

	async init(config: Config): Promise<void> {
		this._config = config

		try {
			this._logger.info('Initializing Process...')
			const certificates = loadCertificatesFromDisk(this._logger, config.certificates)
			this._logger.info('Process initialized')

			this._logger.info('Initializing Core...')
			this.coreHandler = await CoreHandler.create(
				this._logger,
				this._config.core,
				certificates,
				this._config.device
			)

			this._logger.info('Initializing Mos...')
			this.mosHandler = await MosHandler.create(this._logger, this._config.mos, this.coreHandler)

			this._logger.info('Initialization done')
		} catch (e: any) {
			this._logger.error(`Error during initialization: ${stringifyError(e)}`, e.stack)

			this._logger.info('Shutting down in 10 seconds!')

			this.dispose().catch((e2) => this._logger.error(stringifyError(e2)))

			setTimeout(() => {
				// eslint-disable-next-line no-process-exit
				process.exit(0)
			}, 10 * 1000)
		}
	}

	async dispose(): Promise<void> {
		if (this.mosHandler) await this.mosHandler.dispose()

		if (this.coreHandler) await this.coreHandler.dispose()
	}
}

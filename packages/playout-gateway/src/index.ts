import { setupGatewayProcess } from '@sofie-automation/server-core-integration'
import { Connector } from './connector'
import { config, logPath, disableWatchdog, logLevel } from './config'

console.log('process started') // This is a message all Sofie processes log upon startup

const { logger } = setupGatewayProcess({
	logPath,
	logLevel,
})

logger.info('------------------------------------------------------------------')
logger.info('Starting Playout Gateway')
if (disableWatchdog) logger.info('Watchdog is disabled!')
const connector = new Connector(logger)

logger.info('Core:          ' + config.core.host + ':' + config.core.port)
logger.info('------------------------------------------------------------------')
connector.init(config).catch((e) => {
	logger.error(e)
})

import { Connector } from '../connector'
import * as Winston from 'winston'

test('Simple test', async () => {
	let c: Connector

	let logger = Winston.createLogger({
		transports: [new Winston.transports.Console()]
	})
	// @ts-ignore
	logger.info = console.log
	// @ts-ignore
	logger.debug = console.log
	// @ts-ignore
	logger.error = console.log
	// @ts-ignore
	logger.warn = console.log

	c = new Connector(logger)

	expect(c).toBeInstanceOf(Connector)
	await c.dispose()
	expect(1).toEqual(1)
})

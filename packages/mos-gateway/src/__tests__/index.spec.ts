import { Connector } from '../connector'
import * as Winston from 'winston'

test('Simple test', async () => {
	const logger = new Winston.Logger({
		transports: [new Winston.transports.Console()],
	})

	const c: Connector = new Connector(logger)

	expect(c).toBeInstanceOf(Connector)
	await c.dispose()
	expect(1).toEqual(1)
})

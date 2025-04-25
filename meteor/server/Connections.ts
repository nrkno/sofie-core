import { deferAsync, getCurrentTime } from './lib/lib'
import { Meteor } from 'meteor/meteor'
import { logger } from './logging'
import { sendTrace } from './api/integration/influx'
import { PeripheralDevices } from './collections'
import { MetricsGauge } from '@sofie-automation/corelib/dist/prometheus'
import { parseUserPermissions, USER_PERMISSIONS_HEADER } from '@sofie-automation/meteor-lib/dist/userPermissions'
import { Settings } from './Settings'

const connections = new Set<string>()
const connectionsGauge = new MetricsGauge({
	name: `sofie_meteor_ddp_connections_total`,
	help: 'Number of open ddp connections',
})

Meteor.onConnection((conn: Meteor.Connection) => {
	// This is called whenever a new ddp-connection is opened (ie a web-client or a peripheral-device)

	if (Settings.enableHeaderAuth) {
		const userLevel = parseUserPermissions(conn.httpHeaders[USER_PERMISSIONS_HEADER])

		// HACK: force the userId of the connection before it can be used.
		// This ensures we know the permissions of the connection before it can try to do anything
		// This could probably be safely done inside a meteor method, as we only need it when directly modifying a collection in the client,
		// but that will cause all the publications to restart when changing the userId.
		const connSession = (Meteor as any).server.sessions.get(conn.id)
		if (!connSession) {
			logger.error(`Failed to find session for ddp connection! "${conn.id}"`)
			// Close the connection, it won't be secure
			conn.close()
			return
		} else {
			connSession.userId = JSON.stringify(userLevel)
		}
	}

	const connectionId: string = conn.id
	// var clientAddress = conn.clientAddress; // ip-adress

	connections.add(conn.id)
	logger.debug(`Client connected: "${conn.id}", "${conn.clientAddress}"`)
	traceConnections()

	conn.onClose(() => {
		// called when a connection is closed
		connections.delete(conn.id)
		logger.debug(`Client disconnected: "${conn.id}", "${conn.clientAddress}"`)
		traceConnections()

		if (connectionId) {
			deferAsync(async () => {
				const devices = await PeripheralDevices.findFetchAsync({
					connectionId: connectionId,
				})

				for (const device of devices) {
					// set the status of the machine to offline:

					await PeripheralDevices.updateAsync(device._id, {
						$set: {
							lastSeen: getCurrentTime(),
							connected: false,
							// connectionId: ''
						},
					})
					await PeripheralDevices.updateAsync(
						{
							parentDeviceId: device._id,
						},
						{
							$set: {
								lastSeen: getCurrentTime(),
								connected: false,
								// connectionId: ''
							},
						},
						{ multi: true }
					)
				}
			})
		}
	})
})

let logTimeout: number | undefined = undefined
function traceConnections() {
	connectionsGauge.set(connections.size)

	if (logTimeout) {
		clearTimeout(logTimeout)
	}
	logTimeout = Meteor.setTimeout(() => {
		logTimeout = undefined
		logger.debug(`Connection count: ${connections.size}`)

		sendTrace({
			measurement: 'connectionCount',
			timestamp: Date.now(),
			fields: {
				connections: connections.size,
			},
		})
	}, 1000)
}

Meteor.startup(async () => {
	// Reset the connection status of the devices

	await PeripheralDevices.updateAsync(
		{
			connected: true,
			lastSeen: { $lt: getCurrentTime() - 60 * 1000 },
		},
		{
			$set: {
				connected: false,
			},
		},
		{ multi: true }
	)
})

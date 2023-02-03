import { PeripheralDevice } from '../lib/collections/PeripheralDevices'
import { getCurrentTime } from '../lib/lib'
import { Meteor } from 'meteor/meteor'
import { logger } from './logging'
import { sendTrace } from './api/integration/influx'
import { PeripheralDevices } from './collections'

const connections = new Set<string>()

Meteor.onConnection((conn: Meteor.Connection) => {
	// This is called whenever a new ddp-connection is opened (ie a web-client or a peripheral-device)

	const connectionId: string = conn.id
	// var clientAddress = conn.clientAddress; // ip-adress

	connections.add(conn.id)
	traceConnections()

	conn.onClose(() => {
		// called when a connection is closed
		connections.delete(conn.id)
		traceConnections()

		if (connectionId) {
			PeripheralDevices.find({
				connectionId: connectionId,
			}).forEach((p) => {
				// set the status of the machine to offline:

				PeripheralDevices.update(p._id, {
					$set: {
						lastSeen: getCurrentTime(),
						connected: false,
						// connectionId: ''
					},
				})
				PeripheralDevices.update(
					{
						parentDeviceId: p._id,
					},
					{
						$set: {
							lastSeen: getCurrentTime(),
							connected: false,
							// connectionId: ''
						},
					}
				)
			})
		}
	})
})

let logTimeout: number | undefined = undefined
function traceConnections() {
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

Meteor.startup(() => {
	// Reset the connection status of the devices
	PeripheralDevices.find({
		connected: true,
		lastSeen: { $lt: getCurrentTime() - 60 * 1000 },
	}).forEach((device: PeripheralDevice) => {
		PeripheralDevices.update(device._id, {
			$set: {
				connected: false,
			},
		})
	})
})

import * as AMQP from 'amqplib/callback_api'
import { logger } from '../../logging'

function initializeRabbitMQ () {

	AMQP.connect('amqp://localhost', {
		// socketOptions
		heartbeat: 0 // default
	}, (err, connection) => {
		if (err) {
			logger.error('Error when connecting AMQP', err)
			return
		}
		connection.on('error', err => logger.error('AMQP connection error', err))
		connection.on('close', () => logger.error('AMQP connection closed'))
		connection.on('blocked', reason => logger.error('AMQP connection blocked', reason))
		connection.on('unblocked', () => logger.error('AMQP connection unblocked'))

		connection.createConfirmChannel((err, channel) => {
			if (err) {
				logger.error('Error when creating AMQP channel', err)
				return
			}
			channel.on('error', err => logger.error('AMQP channel error', err))
			channel.on('close', () => logger.error('AMQP channel closed'))
			channel.on('blocked', reason => logger.error('AMQP channel blocked', reason))
			channel.on('unblocked', () => logger.error('AMQP channel unblocked'))
			channel.on('return', message => logger.error('AMQP channel return', message))
			channel.on('drain', () => logger.error('AMQP channel drain', ))

			let exchangeTopic = 'sofie.segment.events'
			// let args = process.argv.slice(2)
			let routingKey = 'anonymous.info'
			let message = 'Hello World!'

			channel.assertExchange(exchangeTopic, 'topic', {durable: true})

			let sent = channel.publish(exchangeTopic, routingKey, new Buffer(message), {
				// options
			}, (err, ok) => {
				if (err) {
					logger.error('Error when creating AMQP channel', err)
					return
				}
			})
			if (!sent) {
				// TODO: put message on queue and wait for 'drain' event, then resend
			}
			console.log(" [x] Sent %s:'%s'", routingKey, message)
		})

		// setTimeout(() => {
		// 	conn.close(); process.exit(0)
		// }, 500);
	})
}

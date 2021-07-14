import { logger } from './logging'
import { ConnectionOptions, Queue } from 'bullmq'

console.log('process started') // This is a message all Sofie processes log upon startup

logger.info('Starting ')

console.log('hello world')

const connection: ConnectionOptions = {
	// TODO - something here?
}

const myQueue = new Queue('studio', {
	connection,
})

async function addJobs() {
	console.log('0')
	await myQueue.add('myJobName' + Date.now(), { foo: 'bar' })
	console.log('1')
	await myQueue.add('myJobName2' + Date.now(), { qux: 'baz' })
	console.log('2')
}

addJobs().catch((e) => console.error(e))

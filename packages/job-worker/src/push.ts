import { logger } from './logging'
import { ConnectionOptions, Queue } from 'bullmq'

console.log('process started') // This is a message all Sofie processes log upon startup

logger.info('Starting ')

console.log('hello world')

const connection: ConnectionOptions = {
	// TODO - something here?
}

const studioId = 'studio0'

const myQueue = new Queue(`studio:${studioId}`, {
	connection,
})

async function addJobs() {
	console.log('0')
	await myQueue.add('updateTimeline', { foo: 'bar' })
	console.log('1')
	await myQueue.add('rundownBaselineAdLibPieceStart', {
		playlistId: '0HVrcuJm9VWppKINIr7ba30zpKQ_',
		partInstanceId: 'TXZilha8HiKt9MTNR1T5RtIftlE__ghjvDZeQn8rMiBSjv',
		baselineAdLibPieceId: 'Va08I68HQde7ScHegLBnkgEGHJQ_',
		queue: false,
	})
	console.log('2')
	// eslint-disable-next-line no-process-exit
	process.exit(0)
}

addJobs().catch((e) => console.error(e))

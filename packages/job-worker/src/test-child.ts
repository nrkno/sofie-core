import { expose } from 'threads/worker'

expose({
	async doit(): Promise<void> {
		console.log('thread: hello!')
		process.exit(1)
	},
})

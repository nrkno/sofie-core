import * as chokidar from 'chokidar'
import { writeFileSync } from 'fs'
import appRoot from 'app-root-path'
import { join } from 'path'

/**
 * During development we need to watch some paths for changes and force a restart.
 * This doesn't happen automatically for us, because they are run in a worker_thread and meteor doesn't understand that they are referenced
 */
const paths = [
	'node_modules/@sofie-automation/job-worker/dist',
	'node_modules/@sofie-automation/corelib/dist',
	'node_modules/@sofie-automation/blueprints-integration/dist',
	'node_modules/@sofie-automation/server-core-integration/dist',
]

chokidar
	.watch(paths, {
		ignoreInitial: true,
		cwd: appRoot.path,
	})
	.on('all', () => {
		// The simplest way to trigger a restart of meteor is by changing the source
		writeFileSync(join(appRoot.path, 'server/_force_restart.js'), Date.now().toString())
	})

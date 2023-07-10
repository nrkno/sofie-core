import { ShowStyleBlueprintManifest, StudioBlueprintManifest } from '@sofie-automation/blueprints-integration'
import { createServer } from 'http'
import { SofieToBlueprintMethods, BlueprintToSofieMethods } from './index'
import { Server } from 'socket.io'
import { listenToEvents } from './helper'
import { studio_applyConfig, studio_preprocessConfig, studio_validateConfig } from './routers/studio/config'
import { studio_getBaseline } from './routers/studio/baseline'
import { studio_getRundownPlaylistInfo, studio_getShowStyleId } from './routers/studio/rundown'

export function runForBlueprints(
	studioBlueprint: StudioBlueprintManifest<any, any>,
	_showStyleBlueprint: ShowStyleBlueprintManifest<any, any>
): void {
	// // Clone blueprint and replace any methods with their proxy versions
	// const proxiedStudioBlueprint = klona(studioBlueprint)
	// for (const [key, value] of Object.entries<any>(proxiedStudioBlueprint)) {
	// 	if (typeof value === 'function') {
	// 		// @ts-expect-error key fails
	// 		if (!proxyStudioBlueprint[key]) {
	// 			throw new Error(`Missing key in studio proxy: ${key}`)
	// 		}

	// 		// @ts-expect-error key fails
	// 		proxiedStudioBlueprint[key] = proxyStudioBlueprint[key]
	// 	}
	// }

	const httpServer = createServer()
	const io = new Server<SofieToBlueprintMethods, BlueprintToSofieMethods>(httpServer, {
		cors: {
			// Allow everything
			origin: (o, cb) => cb(null, o),
			credentials: true,
		},
	})

	io.on('connection', (socket) => {
		// ...
		console.log(`connection from ${socket.id}`)

		// subscribe to socket events from host
		listenToEvents<SofieToBlueprintMethods>(socket, {
			studio_getBaseline: async (...args) => studio_getBaseline(studioBlueprint, socket, ...args),
			studio_getShowStyleId: async (...args) => studio_getShowStyleId(studioBlueprint, socket, ...args),
			studio_getRundownPlaylistInfo: async (...args) =>
				studio_getRundownPlaylistInfo(studioBlueprint, socket, ...args),
			studio_validateConfig: async (...args) => studio_validateConfig(studioBlueprint, socket, ...args),
			studio_applyConfig: async (...args) => studio_applyConfig(studioBlueprint, socket, ...args),
			studio_preprocessConfig: async (...args) => studio_preprocessConfig(studioBlueprint, socket, ...args),
		})
	})

	httpServer.listen(2345, () => {
		console.log('Started server')
	})
}

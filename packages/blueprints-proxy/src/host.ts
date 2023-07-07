import { ShowStyleBlueprintManifest, StudioBlueprintManifest } from '@sofie-automation/blueprints-integration'
// import { proxyStudioBlueprint } from './blueprint/studio'
// import { klona } from 'klona/full'
import { createServer } from 'http'
import { ClientToServerEvents, ServerToClientEvents } from './index'
import { Server } from 'socket.io'
import { listenToEvents } from './helper'
import { studio_applyConfig, studio_validateConfig } from './routers/studio/config'

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
	const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
		cors: {
			// Allow everything
			origin: (o, cb) => cb(null, o),
			credentials: true,
		},
		// options
	})

	io.on('connection', (socket) => {
		// ...
		console.log(`connection from ${socket.id}`)

		// subscribe to socket events from host
		listenToEvents<ClientToServerEvents>(socket, {
			// init: this._handleInit.bind(this),
			// destroy: this._handleDestroy.bind(this),
			// updateConfig: this._handleConfigUpdate.bind(this),
			// executeAction: this._handleExecuteAction.bind(this),
			// updateFeedbacks: this._handleUpdateFeedbacks.bind(this),
			// updateActions: this._handleUpdateActions.bind(this),
			// getConfigFields: this._handleGetConfigFields.bind(this),
			// handleHttpRequest: this._handleHttpRequest.bind(this),
			// learnAction: this._handleLearnAction.bind(this),
			// learnFeedback: this._handleLearnFeedback.bind(this),
			// startStopRecordActions: this._handleStartStopRecordActions.bind(this),
			studio_validateConfig: async (...args) => studio_validateConfig(studioBlueprint, socket, ...args),
			studio_applyConfig: async (...args) => studio_applyConfig(studioBlueprint, socket, ...args),
		})
	})

	httpServer.listen(2345, () => {
		console.log('Started server')
	})
}

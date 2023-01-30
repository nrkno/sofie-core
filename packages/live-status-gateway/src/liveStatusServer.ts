import { Logger } from 'winston'
import { CoreHandler } from './coreHandler'
import { WebSocket, WebSocketServer } from 'ws'
import { StudioHandler } from './collections/studio'
import { ShowStyleBaseHandler } from './collections/showStyleBase'
import { PlaylistHandler } from './collections/playlist'
import { RundownHandler } from './collections/rundown'
// import { SegmentHandler } from './collections/segment'
// import { PartHandler } from './collections/part'
import { PartInstancesHandler } from './collections/partInstances'
import { AdLibActionsHandler } from './collections/adLibActions'
import { GlobalAdLibActionsHandler } from './collections/globalAdLibActions'
import { RootChannel } from './topics/root'
import { StudioTopic } from './topics/studio'
import { ActivePlaylistTopic } from './topics/activePlaylist'
import { AdLibsHandler } from './collections/adLibs'
import { GlobalAdLibsHandler } from './collections/globalAdLibs'

export class LiveStatusServer {
	_logger: Logger
	_coreHandler: CoreHandler
	_clients: Set<WebSocket> = new Set()

	constructor(logger: Logger, coreHandler: CoreHandler) {
		this._logger = logger
		this._coreHandler = coreHandler
	}

	async init(): Promise<void> {
		this._logger.info('Initializing WebSocket server...')

		const rootChannel = new RootChannel(this._logger)

		const studioTopic = new StudioTopic(this._logger)
		const activePlaylistTopic = new ActivePlaylistTopic(this._logger)

		rootChannel.addTopic('studio', studioTopic)
		rootChannel.addTopic('activePlaylist', activePlaylistTopic)

		const studioHandler = new StudioHandler(this._logger, this._coreHandler)
		await studioHandler.init()
		const showStyleBaseHandler = new ShowStyleBaseHandler(this._logger, this._coreHandler)
		await showStyleBaseHandler.init()
		const playlistHandler = new PlaylistHandler(this._logger, this._coreHandler)
		await playlistHandler.init()
		const rundownHandler = new RundownHandler(this._logger, this._coreHandler)
		await rundownHandler.init()
		// const segmentHandler = new SegmentHandler(this._logger, this._coreHandler)
		// await segmentHandler.init()
		// const partHandler = new PartHandler(this._logger, this._coreHandler)
		// await partHandler.init()
		const partInstancesHandler = new PartInstancesHandler(this._logger, this._coreHandler)
		await partInstancesHandler.init()
		const adLibActionsHandler = new AdLibActionsHandler(this._logger, this._coreHandler)
		await adLibActionsHandler.init()
		const adLibsHandler = new AdLibsHandler(this._logger, this._coreHandler)
		await adLibsHandler.init()
		const globalAdLibActionsHandler = new GlobalAdLibActionsHandler(this._logger, this._coreHandler)
		await globalAdLibActionsHandler.init()
		const globalAdLibsHandler = new GlobalAdLibsHandler(this._logger, this._coreHandler)
		await globalAdLibsHandler.init()

		// add observers for collection subscription updates
		await playlistHandler.subscribe(rundownHandler)
		// playlistHandler.subscribe(partHandler)
		await playlistHandler.subscribe(partInstancesHandler)
		await rundownHandler.subscribe(showStyleBaseHandler)
		await partInstancesHandler.subscribe(rundownHandler)
		// partInstancesHandler.subscribe(segmentHandler)
		// partInstancesHandler.subscribe(partHandler)
		await partInstancesHandler.subscribe(adLibActionsHandler)
		await partInstancesHandler.subscribe(globalAdLibActionsHandler)

		// add observers for websocket topic updates
		await studioHandler.subscribe(studioTopic)
		await playlistHandler.playlistsHandler.subscribe(studioTopic)
		await playlistHandler.subscribe(activePlaylistTopic)
		await showStyleBaseHandler.subscribe(activePlaylistTopic)
		await partInstancesHandler.subscribe(activePlaylistTopic)
		await adLibActionsHandler.subscribe(activePlaylistTopic)
		await adLibsHandler.subscribe(activePlaylistTopic)
		await globalAdLibActionsHandler.subscribe(activePlaylistTopic)
		await globalAdLibsHandler.subscribe(activePlaylistTopic)

		const wss = new WebSocketServer({ port: 8080 })
		wss.on('connection', (ws, request) => {
			this._logger.info(`WebSocket connection requested for path '${request.url}'`)

			ws.on('close', () => {
				this._logger.info(`Closing websocket`)
				rootChannel.removeSubscriber(ws)
				this._clients.delete(ws)
			})
			this._clients.add(ws)

			if (typeof request.url === 'string' && request.url === '/') {
				rootChannel.addSubscriber(ws)
				ws.on('message', (data) => rootChannel.processMessage(ws, data))
			} else {
				this._logger.error(`WebSocket connection request for unsupported path '${request.url}'`)
			}
		})
		wss.on('close', () => {
			this._logger.info(`WebSocket connection closed`)
			rootChannel.close()
		})
		wss.on('error', (err) => this._logger.error(err.message))

		this._logger.info('WebSocket server initialized')
	}
}

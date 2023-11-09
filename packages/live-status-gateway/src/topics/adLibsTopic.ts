import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { WebSocketTopicBase, WebSocketTopic, CollectionObserver } from '../wsHandler'
import { PlaylistHandler } from '../collections/playlistHandler'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import _ = require('underscore')
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { AdLibActionsHandler } from '../collections/adLibActionsHandler'
import { GlobalAdLibActionsHandler } from '../collections/globalAdLibActionsHandler'
import { AdLibPiece } from '@sofie-automation/corelib/dist/dataModel/AdLibPiece'
import { RundownBaselineAdLibItem } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibPiece'
import {
	IBlueprintActionManifestDisplayContent,
	IOutputLayer,
	ISourceLayer,
} from '@sofie-automation/blueprints-integration'
import { ShowStyleBaseHandler } from '../collections/showStyleBaseHandler'
import { DBShowStyleBase, OutputLayers, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { interpollateTranslation } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { AdLibsHandler } from '../collections/adLibsHandler'
import { GlobalAdLibsHandler } from '../collections/globalAdLibsHandler'

const THROTTLE_PERIOD_MS = 100

export interface AdLibsStatus {
	event: 'adLibs'
	rundownPlaylistId: string | null
	adLibs: AdLibStatus[]
	globalAdLibs: AdLibStatus[]
}

interface AdLibActionType {
	name: string
	label: string
}

interface AdLibStatus {
	id: string
	name: string
	sourceLayer: string
	outputLayer: string
	actionType: AdLibActionType[]
	tags?: string[]
}

export class AdLibsTopic
	extends WebSocketTopicBase
	implements
		WebSocketTopic,
		CollectionObserver<DBRundownPlaylist>,
		CollectionObserver<AdLibAction[]>,
		CollectionObserver<RundownBaselineAdLibAction[]>
{
	public observerName = AdLibsTopic.name
	private _activePlaylist: DBRundownPlaylist | undefined
	private _sourceLayersMap: Map<string, string> = new Map()
	private _outputLayersMap: Map<string, string> = new Map()
	private _adLibActions: AdLibAction[] | undefined
	private _abLibs: AdLibPiece[] | undefined
	private _globalAdLibActions: RundownBaselineAdLibAction[] | undefined
	private _globalAdLibs: RundownBaselineAdLibItem[] | undefined
	private throttledSendStatusToAll: () => void

	constructor(logger: Logger) {
		super(AdLibsTopic.name, logger)
		this.throttledSendStatusToAll = _.throttle(this.sendStatusToAll.bind(this), THROTTLE_PERIOD_MS, {
			leading: true,
			trailing: true,
		})
	}

	addSubscriber(ws: WebSocket): void {
		super.addSubscriber(ws)
		this.sendStatus([ws])
	}

	sendStatus(subscribers: Iterable<WebSocket>): void {
		const adLibs: AdLibStatus[] = []
		const globalAdLibs: AdLibStatus[] = []

		if (this._adLibActions) {
			adLibs.push(
				...this._adLibActions.map((action) => {
					const sourceLayerName = this._sourceLayersMap.get(
						(action.display as IBlueprintActionManifestDisplayContent).sourceLayerId
					)
					const outputLayerName = this._outputLayersMap.get(
						(action.display as IBlueprintActionManifestDisplayContent).outputLayerId
					)
					const triggerModes = action.triggerModes
						? action.triggerModes.map((t) =>
								literal<AdLibActionType>({
									name: t.data,
									label: interpollateTranslation(t.display.label.key, t.display.label.args),
								})
						  )
						: []
					return literal<AdLibStatus>({
						id: unprotectString(action._id),
						name: interpollateTranslation(action.display.label.key, action.display.label.args),
						sourceLayer: sourceLayerName ?? 'invalid',
						outputLayer: outputLayerName ?? 'invalid',
						actionType: triggerModes,
						tags: action.display.tags,
					})
				})
			)
		}

		if (this._abLibs) {
			adLibs.push(
				...this._abLibs.map((adLib) => {
					const sourceLayerName = this._sourceLayersMap.get(adLib.sourceLayerId)
					const outputLayerName = this._outputLayersMap.get(adLib.outputLayerId)
					return literal<AdLibStatus>({
						id: unprotectString(adLib._id),
						name: adLib.name,
						sourceLayer: sourceLayerName ?? 'invalid',
						outputLayer: outputLayerName ?? 'invalid',
						actionType: [],
						tags: adLib.tags,
					})
				})
			)
		}

		if (this._globalAdLibActions) {
			globalAdLibs.push(
				...this._globalAdLibActions.map((action) => {
					const sourceLayerName = this._sourceLayersMap.get(
						(action.display as IBlueprintActionManifestDisplayContent).sourceLayerId
					)
					const outputLayerName = this._outputLayersMap.get(
						(action.display as IBlueprintActionManifestDisplayContent).outputLayerId
					)
					const triggerModes = action.triggerModes
						? action.triggerModes.map((t) =>
								literal<AdLibActionType>({
									name: t.data,
									label: interpollateTranslation(t.display.label.key, t.display.label.args),
								})
						  )
						: []
					return literal<AdLibStatus>({
						id: unprotectString(action._id),
						name: interpollateTranslation(action.display.label.key, action.display.label.args),
						sourceLayer: sourceLayerName ?? 'invalid',
						outputLayer: outputLayerName ?? 'invalid',
						actionType: triggerModes,
						tags: action.display.tags,
					})
				})
			)
		}

		if (this._globalAdLibs) {
			globalAdLibs.push(
				...this._globalAdLibs.map((adLib) => {
					const sourceLayerName = this._sourceLayersMap.get(adLib.sourceLayerId)
					const outputLayerName = this._outputLayersMap.get(adLib.outputLayerId)
					return literal<AdLibStatus>({
						id: unprotectString(adLib._id),
						name: adLib.name,
						sourceLayer: sourceLayerName ?? 'invalid',
						outputLayer: outputLayerName ?? 'invalid',
						actionType: [],
						tags: adLib.tags,
					})
				})
			)
		}

		const adLibsStatus: AdLibsStatus = this._activePlaylist
			? {
					event: 'adLibs',
					rundownPlaylistId: unprotectString(this._activePlaylist._id),
					adLibs,
					globalAdLibs,
			  }
			: { event: 'adLibs', rundownPlaylistId: null, adLibs: [], globalAdLibs: [] }

		for (const subscriber of subscribers) {
			this.sendMessage(subscriber, adLibsStatus)
		}
	}

	async update(
		source: string,
		data:
			| DBRundownPlaylist
			| DBShowStyleBase
			| AdLibAction[]
			| RundownBaselineAdLibAction[]
			| AdLibPiece[]
			| RundownBaselineAdLibItem[]
			| undefined
	): Promise<void> {
		switch (source) {
			case PlaylistHandler.name: {
				const previousPlaylistId = this._activePlaylist?._id
				this._activePlaylist = data as DBRundownPlaylist | undefined
				this._logger.info(`${this._name} received playlist update from ${source}`)
				if (previousPlaylistId === this._activePlaylist?._id) return
				break
			}
			case AdLibActionsHandler.name: {
				const adLibActions = data ? (data as AdLibAction[]) : []
				this._logger.info(`${this._name} received adLibActions update from ${source}`)
				this._adLibActions = adLibActions
				break
			}
			case GlobalAdLibActionsHandler.name: {
				const globalAdLibActions = data ? (data as RundownBaselineAdLibAction[]) : []
				this._logger.info(`${this._name} received globalAdLibActions update from ${source}`)
				this._globalAdLibActions = globalAdLibActions
				break
			}
			case AdLibsHandler.name: {
				const adLibs = data ? (data as AdLibPiece[]) : []
				this._logger.info(`${this._name} received adLibs update from ${source}`)
				this._abLibs = adLibs
				break
			}
			case GlobalAdLibsHandler.name: {
				const globalAdLibs = data ? (data as RundownBaselineAdLibItem[]) : []
				this._logger.info(`${this._name} received globalAdLibs update from ${source}`)
				this._globalAdLibs = globalAdLibs
				break
			}
			case ShowStyleBaseHandler.name: {
				const sourceLayers: SourceLayers = data
					? applyAndValidateOverrides((data as DBShowStyleBase).sourceLayersWithOverrides).obj
					: {}
				const outputLayers: OutputLayers = data
					? applyAndValidateOverrides((data as DBShowStyleBase).outputLayersWithOverrides).obj
					: {}
				this._logger.info(
					`${this._name} received showStyleBase update with sourceLayers [${Object.values<
						ISourceLayer | undefined
					>(sourceLayers).map(
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
						(s) => s!.name
					)}]`
				)
				this._logger.info(
					`${this._name} received showStyleBase update with outputLayers [${Object.values<
						IOutputLayer | undefined
					>(outputLayers).map(
						// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
						(s) => s!.name
					)}]`
				)
				this._sourceLayersMap.clear()
				this._outputLayersMap.clear()
				for (const [layerId, sourceLayer] of Object.entries<ISourceLayer | undefined>(sourceLayers)) {
					if (sourceLayer === undefined || sourceLayer === null) continue
					this._sourceLayersMap.set(layerId, sourceLayer.name)
				}
				for (const [layerId, outputLayer] of Object.entries<IOutputLayer | undefined>(outputLayers)) {
					if (outputLayer === undefined || outputLayer === null) continue
					this._outputLayersMap.set(layerId, outputLayer.name)
				}
				break
			}
			default:
				throw new Error(`${this._name} received unsupported update from ${source}}`)
		}

		this.throttledSendStatusToAll()
	}

	private sendStatusToAll() {
		this.sendStatus(this._subscribers)
	}
}

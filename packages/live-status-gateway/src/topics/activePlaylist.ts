import { Logger } from 'winston'
import { WebSocket } from 'ws'
import { unprotectString } from '@sofie-automation/shared-lib/dist/lib/protectedString'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { DBShowStyleBase, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBPartInstance } from '@sofie-automation/corelib/dist/dataModel/PartInstance'
import { AdLibAction } from '@sofie-automation/corelib/dist/dataModel/AdlibAction'
import { RundownBaselineAdLibAction } from '@sofie-automation/corelib/dist/dataModel/RundownBaselineAdLibAction'
import { IBlueprintActionManifestDisplayContent } from '@sofie-automation/blueprints-integration'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { WsTopicBase, WsTopic, CollectionObserver } from '../wsHandler'
import { PartInstanceName } from '../collections/partInstances'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'

interface PartStatus {
	id: string
	name: string
	autoNext?: boolean
}

interface AdLibActionType {
	name: string
	label: string
}

interface AdLibActionStatus {
	id: string
	name: string
	sourceLayer: string
	actionType: AdLibActionType[]
}

interface ActivePlaylistStatus {
	event: string
	id: string | null
	name: string
	rundownIds: string[]
	currentPart: PartStatus | null
	nextPart: PartStatus | null
	adlibActions: AdLibActionStatus[]
	globalAdlibActions: AdLibActionStatus[]
}

export class ActivePlaylistTopic
	extends WsTopicBase
	implements
		WsTopic,
		CollectionObserver<DBRundownPlaylist>,
		CollectionObserver<Map<PartInstanceName, DBPartInstance | undefined>>,
		CollectionObserver<AdLibAction[]>,
		CollectionObserver<RundownBaselineAdLibAction[]>
{
	_observerName = 'ActivePlaylistTopic'
	_sourceLayersMap: Map<string, string> = new Map()
	_activePlaylist: DBRundownPlaylist | undefined
	_currentPartInstance: DBPartInstance | undefined
	_nextPartInstance: DBPartInstance | undefined
	_adLibActions: AdLibAction[] | undefined
	_globalAdLibActions: RundownBaselineAdLibAction[] | undefined

	constructor(logger: Logger) {
		super('ActivePlaylistTopic', logger)
	}

	addSubscriber(ws: WebSocket): void {
		super.addSubscriber(ws)
		this.sendStatus(new Set<WebSocket>().add(ws))
	}

	sendStatus(subscribers: Set<WebSocket>): void {
		const currentPart = this._currentPartInstance ? this._currentPartInstance.part : null
		const nextPart = this._nextPartInstance ? this._nextPartInstance.part : null
		subscribers.forEach((ws) => {
			this.sendMessage(
				ws,
				this._activePlaylist
					? literal<ActivePlaylistStatus>({
							event: 'activePlaylist',
							id: unprotectString(this._activePlaylist._id),
							name: this._activePlaylist.name,
							rundownIds: this._activePlaylist.rundownIdsInOrder.map((r) => unprotectString(r)),
							currentPart: currentPart
								? literal<PartStatus>({
										id: unprotectString(currentPart._id),
										name: currentPart.title,
										autoNext: currentPart.autoNext,
								  })
								: null,
							nextPart: nextPart
								? literal<PartStatus>({
										id: unprotectString(nextPart._id),
										name: nextPart.title,
										autoNext: nextPart.autoNext,
								  })
								: null,
							adlibActions: this._adLibActions
								? this._adLibActions.map((action) => {
										const sourceLayerName = this._sourceLayersMap.get(
											(action.display as IBlueprintActionManifestDisplayContent).sourceLayerId
										)
										const triggerModes = action.triggerModes
											? action.triggerModes.map((t) =>
													literal<AdLibActionType>({
														name: t.data,
														label: t.display.label.key,
													})
											  )
											: []
										return literal<AdLibActionStatus>({
											id: unprotectString(action._id),
											name: action.display.label.key,
											sourceLayer: sourceLayerName ? sourceLayerName : 'invalid',
											actionType: triggerModes,
										})
								  })
								: [],
							globalAdlibActions: this._globalAdLibActions
								? this._globalAdLibActions.map((action) => {
										const sourceLayerName = this._sourceLayersMap.get(
											(action.display as IBlueprintActionManifestDisplayContent).sourceLayerId
										)
										const triggerModes = action.triggerModes
											? action.triggerModes.map((t) =>
													literal<AdLibActionType>({
														name: t.data,
														label: t.display.label.key,
													})
											  )
											: []
										return literal<AdLibActionStatus>({
											id: unprotectString(action._id),
											name: action.display.label.key,
											sourceLayer: sourceLayerName ? sourceLayerName : 'invalid',
											actionType: triggerModes,
										})
								  })
								: [],
					  })
					: literal<ActivePlaylistStatus>({
							event: 'activePlaylist',
							id: null,
							name: '',
							rundownIds: [],
							currentPart: null,
							nextPart: null,
							adlibActions: [],
							globalAdlibActions: [],
					  })
			)
		})
	}

	update(
		source: string,
		data:
			| DBRundownPlaylist
			| DBShowStyleBase
			| Map<PartInstanceName, DBPartInstance | undefined>
			| AdLibAction[]
			| RundownBaselineAdLibAction[]
			| undefined
	): void {
		const rundownPlaylist = data ? (data as DBRundownPlaylist) : undefined
		const sourceLayers: SourceLayers = data
			? applyAndValidateOverrides((data as DBShowStyleBase).sourceLayersWithOverrides).obj
			: {}
		const partInstances = data as Map<PartInstanceName, DBPartInstance | undefined>
		const adLibActions = data ? (data as AdLibAction[]) : []
		const globalAdLibActions = data ? (data as RundownBaselineAdLibAction[]) : []
		switch (source) {
			case 'PlaylistHandler':
				this._logger.info(
					`${this._name} received playlist update ${rundownPlaylist?._id}, activationId ${rundownPlaylist?.activationId}`
				)
				this._activePlaylist = unprotectString(rundownPlaylist?.activationId) ? rundownPlaylist : undefined
				break
			case 'ShowStyleBaseHandler':
				this._logger.info(
					`${this._name} received showStyleBase update with sourceLayers [${Object.values(sourceLayers).map(
						(s) => s!.name
					)}]`
				)
				this._sourceLayersMap.clear()
				for (const [layerId, sourceLayer] of Object.entries(sourceLayers)) {
					if (sourceLayer === undefined || sourceLayer === null) continue
					this._sourceLayersMap.set(layerId, sourceLayer.name)
				}
				break
			case 'PartInstancesHandler':
				this._logger.info(`${this._name} received partInstances update from ${source}`)
				this._currentPartInstance = partInstances.get(PartInstanceName.cur)
				this._nextPartInstance = partInstances.get(PartInstanceName.next)
				break
			case 'AdLibActionHandler':
				this._logger.info(`${this._name} received adLibActions update from ${source}`)
				this._adLibActions = adLibActions
				break
			case 'GlobalAdLibActionHandler':
				this._logger.info(`${this._name} received globalAdLibActions update from ${source}`)
				this._globalAdLibActions = globalAdLibActions
				break
			default:
				throw new Error(`${this._name} received unsupported update from ${source}}`)
		}

		process.nextTick(() => this.sendStatus(this._subscribers))
	}
}

import { Logger } from 'winston'
import { CoreHandler } from '../coreHandler'
import { CollectionBase, Collection, CollectionObserver } from '../wsHandler'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { DBShowStyleBase, OutputLayers, SourceLayers } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { ShowStyleBaseId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { CollectionName } from '@sofie-automation/corelib/dist/dataModel/Collections'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { IOutputLayer, ISourceLayer } from '@sofie-automation/blueprints-integration'

export interface ShowStyleBaseExt extends DBShowStyleBase {
	sourceLayerNamesById: ReadonlyMap<string, string>
	outputLayerNamesById: ReadonlyMap<string, string>
}

export class ShowStyleBaseHandler
	extends CollectionBase<ShowStyleBaseExt, CorelibPubSub.showStyleBases, CollectionName.ShowStyleBases>
	implements Collection<ShowStyleBaseExt>, CollectionObserver<DBRundown>
{
	public observerName: string
	private _showStyleBaseId: ShowStyleBaseId | undefined
	private _sourceLayersMap: Map<string, string> = new Map()
	private _outputLayersMap: Map<string, string> = new Map()

	constructor(logger: Logger, coreHandler: CoreHandler) {
		super(
			ShowStyleBaseHandler.name,
			CollectionName.ShowStyleBases,
			CorelibPubSub.showStyleBases,
			logger,
			coreHandler
		)
		this.observerName = this._name
	}

	async changed(id: ShowStyleBaseId, changeType: string): Promise<void> {
		this.logDocumentChange(id, changeType)
		if (!this._collectionName) return
		if (this._showStyleBaseId) {
			this.updateCollectionData()
			await this.notify(this._collectionData)
		}
	}

	async update(source: string, data: DBRundown | undefined): Promise<void> {
		this.logUpdateReceived('rundown', source, `rundownId ${data?._id}, showStyleBaseId ${data?.showStyleBaseId}`)
		const prevShowStyleBaseId = this._showStyleBaseId
		this._showStyleBaseId = data?.showStyleBaseId

		await new Promise(process.nextTick.bind(this))
		if (!this._collectionName) return
		if (!this._publicationName) return
		if (prevShowStyleBaseId !== this._showStyleBaseId) {
			if (this._subscriptionId) this._coreHandler.unsubscribe(this._subscriptionId)
			if (this._dbObserver) this._dbObserver.stop()
			if (this._showStyleBaseId) {
				this._subscriptionId = await this._coreHandler.setupSubscription(this._publicationName, [
					this._showStyleBaseId,
				])
				this._dbObserver = this._coreHandler.setupObserver(this._collectionName)
				this._dbObserver.added = (id) => {
					void this.changed(id, 'added').catch(this._logger.error)
				}
				this._dbObserver.changed = (id) => {
					void this.changed(id, 'changed').catch(this._logger.error)
				}

				this.updateCollectionData()
				await this.notify(this._collectionData)
			}
		}
	}

	updateCollectionData(): void {
		const collection = this._core.getCollection(this._collectionName)
		if (!collection) throw new Error(`collection '${this._collectionName}' not found!`)
		if (!this._showStyleBaseId) return
		const showStyleBase = collection.findOne(this._showStyleBaseId)
		if (!showStyleBase) {
			this._collectionData = undefined
			return
		}
		const sourceLayers: SourceLayers = showStyleBase
			? applyAndValidateOverrides(showStyleBase.sourceLayersWithOverrides).obj
			: {}
		const outputLayers: OutputLayers = showStyleBase
			? applyAndValidateOverrides(showStyleBase.outputLayersWithOverrides).obj
			: {}
		this._logger.info(
			`${this._name} received showStyleBase update with sourceLayers [${Object.values<ISourceLayer | undefined>(
				sourceLayers
			).map(
				// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
				(s) => s!.name
			)}]`
		)
		this._logger.info(
			`${this._name} received showStyleBase update with outputLayers [${Object.values<IOutputLayer | undefined>(
				outputLayers
			).map(
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
		const showStyleBaseExt = {
			...showStyleBase,
			sourceLayerNamesById: this._sourceLayersMap,
			outputLayerNamesById: this._outputLayersMap,
		}
		this._collectionData = showStyleBaseExt
	}
}

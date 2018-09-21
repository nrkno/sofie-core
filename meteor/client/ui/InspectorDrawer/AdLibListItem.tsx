import * as React from 'react'

import { Translated } from '../../lib/ReactMeteorData/react-meteor-data'
import { translate } from 'react-i18next'
import { SegmentLineAdLibItem } from '../../../lib/collections/SegmentLineAdLibItems'
import { IOutputLayer, ISourceLayer } from '../../../lib/collections/StudioInstallations'
import { RundownAPI } from '../../../lib/api/rundown'
import * as ClassNames from 'classnames'

import { DefaultListItemRenderer } from './Renderers/DefaultLayerItemRenderer'
import { SegmentLineAdLibItemUi } from './AdLibPanel'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { mousetrapHelper } from '../../lib/moustrapHelper'

export interface IAdLibListItem {
	_id: string,
	name: string,
	status?: RundownAPI.LineItemStatusCode
	hotkey?: string
	isHidden?: boolean
}

interface IListViewItemProps {
	item: IAdLibListItem
	selected: boolean
	layer: ISourceLayer
	outputLayer?: IOutputLayer
	onSelectAdLib: (aSLine: IAdLibListItem) => void
	onToggleAdLib: (aSLine: IAdLibListItem, queue: boolean, context: any) => void
}

export const AdLibListItem = translate()(class extends MeteorReactComponent<Translated<IListViewItemProps>> {
	constructor (props: Translated<IListViewItemProps>) {
		super(props)
	}

	render () {
		return (
			<tr className={ClassNames('adlib-panel__list-view__list__segment__item', {
				'selected': this.props.selected
			})} key={this.props.item._id}
				onClick={(e) => this.props.onSelectAdLib(this.props.item)}
				onDoubleClick={(e) => this.props.onToggleAdLib(this.props.item, e.shiftKey, e)}>
				<td className={ClassNames('adlib-panel__list-view__list__table__cell--icon', this.props.layer && {
					'audio': this.props.layer.type === RundownAPI.SourceLayerType.AUDIO,
					'camera': this.props.layer.type === RundownAPI.SourceLayerType.CAMERA,
					'camera-movement': this.props.layer.type === RundownAPI.SourceLayerType.CAMERA_MOVEMENT,
					'graphics': this.props.layer.type === RundownAPI.SourceLayerType.GRAPHICS,
					'lower-third': this.props.layer.type === RundownAPI.SourceLayerType.LOWER_THIRD,
					'live-speak': this.props.layer.type === RundownAPI.SourceLayerType.LIVE_SPEAK,
					'mic': this.props.layer.type === RundownAPI.SourceLayerType.MIC,
					'metadata': this.props.layer.type === RundownAPI.SourceLayerType.METADATA,
					'remote': this.props.layer.type === RundownAPI.SourceLayerType.REMOTE,
					'script': this.props.layer.type === RundownAPI.SourceLayerType.SCRIPT,
					'splits': this.props.layer.type === RundownAPI.SourceLayerType.SPLITS,
					'vt': this.props.layer.type === RundownAPI.SourceLayerType.VT,

					'source-missing': this.props.item.status === RundownAPI.LineItemStatusCode.SOURCE_MISSING,
					'source-broken': this.props.item.status === RundownAPI.LineItemStatusCode.SOURCE_BROKEN,
					'unknown-state': this.props.item.status === RundownAPI.LineItemStatusCode.UNKNOWN
				})}>
					{this.props.layer && (this.props.layer.abbreviation || this.props.layer.name)}
				</td>
				<td className='adlib-panel__list-view__list__table__cell--shortcut'>
					{this.props.item.hotkey && mousetrapHelper.shortcutLabel(this.props.item.hotkey)}
				</td>
				<td className='adlib-panel__list-view__list__table__cell--output'>
					{this.props.outputLayer && this.props.outputLayer.name}
				</td>
				<DefaultListItemRenderer {...this.props} />
			</tr>
		)
	}
})

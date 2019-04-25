import * as React from 'react'
import { Translated } from '../../lib/ReactMeteorData/react-meteor-data'
import { translate } from 'react-i18next'
import { RundownAPI } from '../../../lib/api/rundown'
import * as ClassNames from 'classnames'

import { DefaultListItemRenderer } from './Renderers/DefaultLayerItemRenderer'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { mousetrapHelper } from '../../lib/mousetrapHelper'
import { RundownUtils } from '../../lib/rundown'
import { ISourceLayer, IOutputLayer } from 'tv-automation-sofie-blueprints-integration'

export interface IAdLibListItem {
	_id: string,
	name: string,
	status?: RundownAPI.LineItemStatusCode
	hotkey?: string
	isHidden?: boolean
	invalid?: boolean
}

interface IListViewItemProps {
	item: IAdLibListItem
	selected: boolean
	layer: ISourceLayer
	outputLayer?: IOutputLayer
	onSelectAdLib: (aSLine: IAdLibListItem) => void
	onToggleAdLib: (aSLine: IAdLibListItem, queue: boolean, context: any) => void
}

const _isMacLike = navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i) ? true : false

export const AdLibListItem = translate()(class extends MeteorReactComponent<Translated<IListViewItemProps>> {
	constructor (props: IListViewItemProps) {
		super(props)
	}

	render () {
		return (
			<tr className={ClassNames('adlib-panel__list-view__list__segment__item', {
				'selected': this.props.selected,
				'invalid': this.props.item.invalid
			})} key={this.props.item._id}
				onClick={(e) => this.props.onSelectAdLib(this.props.item)}
				onDoubleClick={(e) => this.props.onToggleAdLib(this.props.item, e.shiftKey, e)}>
				<td className={ClassNames(
					'adlib-panel__list-view__list__table__cell--icon',
					RundownUtils.getSourceLayerClassName(this.props.layer.type),
					{
						'source-missing': this.props.item.status === RundownAPI.LineItemStatusCode.SOURCE_MISSING,
						'source-broken': this.props.item.status === RundownAPI.LineItemStatusCode.SOURCE_BROKEN,
						'unknown-state': this.props.item.status === RundownAPI.LineItemStatusCode.UNKNOWN
					}
				)}>
					{this.props.layer && (this.props.layer.abbreviation || this.props.layer.name)}
				</td>
				<td className='adlib-panel__list-view__list__table__cell--shortcut'>
					{this.props.item.hotkey && mousetrapHelper.shortcutLabel(this.props.item.hotkey, _isMacLike)}
				</td>
				<td className='adlib-panel__list-view__list__table__cell--output'>
					{this.props.outputLayer && this.props.outputLayer.name}
				</td>
				<DefaultListItemRenderer {...this.props} />
			</tr>
		)
	}
})

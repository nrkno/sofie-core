import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import * as ReactDOM from 'react-dom'
import * as _ from 'underscore'
import * as $ from 'jquery'

import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { translate, InjectedTranslateProps } from 'react-i18next'
import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { Segment, Segments } from '../../../lib/collections/Segments'
import { SegmentLine, SegmentLines } from '../../../lib/collections/SegmentLines'
import { SegmentLineAdLibItem } from '../../../lib/collections/SegmentLineAdLibItems'
import { StudioInstallation, IOutputLayer, ISourceLayer } from '../../../lib/collections/StudioInstallations'
import { RundownAPI } from '../../../lib/api/rundown'
import * as ClassNames from 'classnames'

import * as faTh from '@fortawesome/fontawesome-free-solid/faTh'
import * as faList from '@fortawesome/fontawesome-free-solid/faList'
import * as faTimes from '@fortawesome/fontawesome-free-solid/faTimes'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { Spinner } from '../../lib/Spinner'

import { DefaultListItemRenderer } from './Renderers/DefaultLayerItemRenderer'
import { SegmentLineAdLibItemUi } from './AdLibPanel'

interface IListViewItemPropsHeader {
	item: SegmentLineAdLibItemUi
	selected: boolean
	layer: ISourceLayer
	outputLayer: IOutputLayer
	onSelectAdLib: (aSLine: SegmentLineAdLibItem) => void
	onToggleAdLib: (aSLine: SegmentLineAdLibItem) => void
}

export const AdLibListItem = translate()(class extends React.Component<IListViewItemPropsHeader & InjectedTranslateProps> {
	constructor (props) {
		super(props)
	}

	render () {
		return (
			<tr className={ClassNames('adlib-panel__list-view__list__segment__item', {
				'selected': this.props.selected
			})} key={this.props.item._id}
				onClick={(e) => this.props.onSelectAdLib(this.props.item)}
				onDoubleClick={(e) => this.props.onToggleAdLib(this.props.item)}>
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
					{this.props.layer && this.props.layer.name}
				</td>
				<td className='adlib-panel__list-view__list__table__cell--shortcut'>
					{this.props.item.hotkey && this.props.item.hotkey.toUpperCase()}
				</td>
				<td className='adlib-panel__list-view__list__table__cell--output'>
					{this.props.outputLayer && this.props.outputLayer.name}
				</td>
				<DefaultListItemRenderer {...this.props} />
			</tr>
		)
	}
})

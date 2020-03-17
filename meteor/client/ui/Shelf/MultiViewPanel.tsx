import * as React from 'react'
import * as _ from 'underscore'
import { RundownLayoutBase, RundownLayoutMultiView, DashboardLayoutMultiView } from '../../../lib/collections/RundownLayouts'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { dashboardElementPosition } from './DashboardPanel'
import { Rundown } from '../../../lib/collections/Rundowns'
import * as classNames from 'classnames'

interface IProps {
	layout: RundownLayoutBase
	panel: RundownLayoutMultiView
	visible: boolean
	rundown: Rundown
}

function getImagePosition (id: number): React.CSSProperties {
	let rectangle = [
		{ x: 0.005, y: 0.0058, width: 0.49, height: 0.487 },
		{ x: 0.505, y: 0.0058, width: 0.49, height: 0.487 },
		{ x: 0.005, y: 0.5055, width: 0.24, height: 0.239 },
		{ x: 0.255, y: 0.5055, width: 0.24, height: 0.239 },
		{ x: 0.505, y: 0.5055, width: 0.24, height: 0.239 },
		{ x: 0.755, y: 0.5055, width: 0.24, height: 0.239 },
		{ x: 0.005, y: 0.7555, width: 0.24, height: 0.239 },
		{ x: 0.255, y: 0.7555, width: 0.24, height: 0.239 },
		{ x: 0.505, y: 0.7555, width: 0.24, height: 0.239 },
		{ x: 0.755, y: 0.7555, width: 0.24, height: 0.239 }
	][id - 1]
	if	(!rectangle) {
		rectangle = { x: 0, y: 0, width: 1, height: 1 }
	}
	return {
		width: (100 / rectangle.width) + '%',
		height: (100 / rectangle.height) + '%',
		top: (-100 * rectangle.y / rectangle.height) + '%',
		left: (-100 * rectangle.x / rectangle.width) + '%'
	}
}

export class MultiViewPanel extends React.Component<IProps> {


	render () {
		const isLarge = RundownLayoutsAPI.isDashboardLayout(this.props.layout) && (this.props.panel as DashboardLayoutMultiView).width > 11
		return <div className='multiview-panel'
			style={
				_.extend(
					RundownLayoutsAPI.isDashboardLayout(this.props.layout) ?
						dashboardElementPosition(this.props.panel as DashboardLayoutMultiView) :
						{},
					{
						'visibility': this.props.visible ? 'visible' : 'hidden'
					}
				)
			}>
			<div className='multiview-panel__image-container' >
				<img
				className='multiview-panel__image'
				src={this.props.panel.url}
				style={getImagePosition(this.props.panel.windowNumber)}
				/>
				{!isLarge &&
					<span className={classNames('multiview-panel__label')}>{this.props.panel.name}</span>
				}
			</div>
			{isLarge &&
				<span className={classNames('multiview-panel__label')}>{this.props.panel.name}</span>
			}
		</div>
	}
}
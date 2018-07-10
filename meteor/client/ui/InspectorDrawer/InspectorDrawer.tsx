import * as React from 'react'
import { translate } from 'react-i18next'

import * as ClassNames from 'classnames'

import * as faBars from '@fortawesome/fontawesome-free-solid/faBars'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { AdLibPanel } from './AdLibPanel'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { SegmentUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { StudioInstallation } from '../../../lib/collections/StudioInstallations'

enum InspectorPanelTabs {
	ADLIB = 'adlib'
}
interface IProps {
	segments: Array<SegmentUi>
	liveSegment?: SegmentUi
	runningOrder: RunningOrder
	studioInstallation: StudioInstallation

	onChangeBottomMargin?: (newBottomMargin: string) => void
}

interface IState {
	expanded: boolean
	selectedTab: InspectorPanelTabs
}

export const InspectorDrawer = translate()(class extends React.Component<Translated<IProps>, IState> {
	constructor (props: Translated<IProps>) {
		super(props)

		this.state = {
			expanded: false,
			selectedTab: InspectorPanelTabs.ADLIB
		}
	}

	getHeight (newState?: boolean): string | undefined {
		return (newState !== undefined ? newState : this.state.expanded) ?
			'50vh'
			:
			undefined
	}

	getStyle () {
		return this.state.expanded ?
		{
			'top': this.getHeight(),
			'transition': '0.5s top ease-out'
		}
		:
		{
			'top': this.getHeight(),
			'transition': '0.5s top ease-out'
		}
	}

	toggleDrawer () {
		this.setState({
			expanded: !this.state.expanded
		})
		if (this.props.onChangeBottomMargin && typeof this.props.onChangeBottomMargin === 'function') {
			this.props.onChangeBottomMargin(this.getHeight(!this.state.expanded) || '0px')
		}
	}

	switchTab (tab: InspectorPanelTabs) {
		this.setState({
			selectedTab: tab
		})
	}

	render () {
		const { t } = this.props
		return (
			<div className='running-order-view__inspector-drawer dark' style={this.getStyle()}>
				<div className='running-order-view__inspector-drawer__handle dark' tabIndex={0} onClick={(e) => this.toggleDrawer()}>
					<FontAwesomeIcon icon={faBars} />
				</div>
				<div className='running-order-view__inspector-drawer__tabs'>
					<div className={ClassNames('running-order-view__inspector-drawer__tabs__tab', {
						'selected': this.state.selectedTab === InspectorPanelTabs.ADLIB
					})} onClick={(e) => this.switchTab(InspectorPanelTabs.ADLIB)} tabIndex={0}>{t('AdLib')}</div>
				</div>
				<div className='running-order-view__inspector-drawer__panel super-dark'>
					<AdLibPanel {...this.props}></AdLibPanel>
				</div>
			</div>
		)
	}
})

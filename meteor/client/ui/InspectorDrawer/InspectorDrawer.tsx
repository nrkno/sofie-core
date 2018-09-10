import * as React from 'react'
import { translate } from 'react-i18next'

import * as ClassNames from 'classnames'
import * as _ from 'underscore'
import * as $ from 'jquery'
import * as mousetrap from 'mousetrap'

import * as faBars from '@fortawesome/fontawesome-free-solid/faBars'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { AdLibPanel } from './AdLibPanel'
import { GlobalAdLibPanel } from './GlobalAdLibPanel'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { SegmentUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { RunningOrder } from '../../../lib/collections/RunningOrders'
import { StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { RunningOrderViewKbdShortcuts } from '../RunningOrderView'
import { HotkeyHelpPanel } from './HotkeyHelpPanel'

enum InspectorPanelTabs {
	ADLIB = 'adlib',
	GLOBAL_ADLIB = 'global_adlib',
	SYSTEM_HOTKEYS = 'system_hotkeys'
}
interface IProps {
	segments: Array<SegmentUi>
	liveSegment?: SegmentUi
	runningOrder: RunningOrder
	studioInstallation: StudioInstallation
	studioMode: boolean
	hotkeys: Array<{
		key: string
		label: string
	}>

	onRegisterHotkeys: (hotkeys: Array<{
		key: string
		label: string
	}>) => void
	onChangeBottomMargin?: (newBottomMargin: string) => void
}

interface IState {
	expanded: boolean
	drawerHeight: string
	overrideHeight: number | undefined
	moving: boolean
	selectedTab: InspectorPanelTabs
}

const CLOSE_MARGIN = 45

export const InspectorDrawer = translate()(class extends React.Component<Translated<IProps>, IState> {
	private _mouseStart: {
		x: number
		y: number
	} = {
		x: 0,
		y: 0
	}
	private _mouseOffset: {
		x: number
		y: number
	} = {
		x: 0,
		y: 0
	}
	private _mouseDown: number

	private bindKeys: Array<{
		key: string
		up?: (e: KeyboardEvent) => any
		down?: (e: KeyboardEvent) => any
		label: string
		global?: boolean
	}> = []

	constructor (props: Translated<IProps>) {
		super(props)

		this.state = {
			expanded: false,
			moving: false,
			drawerHeight: localStorage.getItem('runningOrderView.inspectorDrawer.drawerHeight') || '50vh',
			overrideHeight: undefined,
			selectedTab: InspectorPanelTabs.ADLIB
		}

		const { t } = props

		this.bindKeys = [
			{
				key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_TOGGLE_DRAWER,
				up: this.keyToggleDrawer,
				label: t('Toggle drawer')
			},
			// {
			// 	key: RunningOrderViewKbdShortcuts.RUNNING_ORDER_RESET_FOCUS,
			// 	up: this.keyBlurActiveElement,
			// 	label: t('Escape from filter search'),
			// 	global: true
			// }
		]
	}

	componentDidMount () {
		let preventDefault = (e) => {
			e.preventDefault()
			e.stopImmediatePropagation()
			e.stopPropagation()
		}
		_.each(this.bindKeys, (k) => {
			const method = k.global ? mousetrap.bindGlobal : mousetrap.bind
			if (k.up) {
				method(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
					if (k.up) k.up(e)
				}, 'keyup')
				method(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
				}, 'keydown')
			}
			if (k.down) {
				method(k.key, (e: KeyboardEvent) => {
					preventDefault(e)
					if (k.down) k.down(e)
				}, 'keydown')
			}
		})

		this.props.onRegisterHotkeys(this.bindKeys)
	}

	componentWillUnmount () {
		_.each(this.bindKeys, (k) => {
			if (k.up) {
				mousetrap.unbind(k.key, 'keyup')
				mousetrap.unbind(k.key, 'keydown')
			}
			if (k.down) {
				mousetrap.unbind(k.key, 'keydown')
			}
		})
	}

	componentDidUpdate (prevProps, prevState: IState) {
		if ((prevState.expanded !== this.state.expanded) || (prevState.drawerHeight !== this.state.drawerHeight)) {
			if (this.props.onChangeBottomMargin && typeof this.props.onChangeBottomMargin === 'function') {
				console.log(this.state.expanded, this.getHeight())
				this.props.onChangeBottomMargin(this.getHeight() || '0px')
			}
		}
	}

	getHeight (): string {
		const top = parseFloat(this.state.drawerHeight.substr(0, this.state.drawerHeight.length - 2))
		return this.state.expanded ? (100 - top).toString() + 'vh' : '0px'
	}

	getTop (newState?: boolean): string | undefined {
		return this.state.overrideHeight ?
			((this.state.overrideHeight / window.innerHeight) * 100) + 'vh' :
			((newState !== undefined ? newState : this.state.expanded) ?
				this.state.drawerHeight
				:
				undefined)
	}

	getStyle () {
		return this.state.expanded ?
		{
			'top': this.getTop(),
			'transition': this.state.moving ? '' : '0.5s top ease-out'
		}
		:
		{
			'top': this.getTop(),
			'transition': this.state.moving ? '' : '0.5s top ease-out'
		}
	}

	keyBlurActiveElement = () => {
		this.blurActiveElement()
	}

	keyToggleDrawer = () => {
		this.toggleDrawer()
	}

	blurActiveElement = () => {
		try {
			// @ts-ignore
			document.activeElement.blur()
		} catch (e) {
			// do nothing
		}
	}

	toggleDrawer = () => {
		this.blurActiveElement();
		this.setState({
			expanded: !this.state.expanded
		})
	}

	dropHandle = (e: MouseEvent) => {
		document.removeEventListener('mouseup', this.dropHandle)
		document.removeEventListener('mouseleave', this.dropHandle)
		document.removeEventListener('mousemove', this.dragHandle)

		let stateChange = {
			moving: false,
			overrideHeight: undefined
		}

		if (Date.now() - this._mouseDown > 350) {
			if (this.state.overrideHeight && (window.innerHeight - this.state.overrideHeight > CLOSE_MARGIN)) {
				stateChange = _.extend(stateChange, {
					drawerHeight: (Math.max(0.1, 0, this.state.overrideHeight / window.innerHeight) * 100) + 'vh',
					expanded: true
				})
			} else {
				stateChange = _.extend(stateChange, {
					expanded: false
				})
			}
		} else {
			stateChange = _.extend(stateChange, {
				expanded: !this.state.expanded
			})
		}

		this.setState(stateChange)
		this.blurActiveElement()

		localStorage.setItem('runningOrderView.inspectorDrawer.drawerHeight', this.state.drawerHeight)
	}

	dragHandle = (e: MouseEvent) => {
		this.setState({
			overrideHeight: e.clientY - this._mouseOffset.y
		})
	}

	grabHandle = (e: React.MouseEvent<HTMLDivElement>) => {
		document.addEventListener('mouseup', this.dropHandle)
		document.addEventListener('mouseleave', this.dropHandle)
		document.addEventListener('mousemove', this.dragHandle)

		this._mouseStart.x = e.clientX
		this._mouseStart.y = e.clientY

		const handlePosition = $(e.currentTarget).offset()
		if (handlePosition) {
			this._mouseOffset.x = (handlePosition.left - ($('html,body').scrollLeft() || 0)) - this._mouseStart.x
			this._mouseOffset.y = (handlePosition.top - ($('html,body').scrollTop() || 0)) - this._mouseStart.y
		}

		this._mouseDown = Date.now()

		this.setState({
			moving: true
		})
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
				<div className='running-order-view__inspector-drawer__handle dark' tabIndex={0} onMouseDown={this.grabHandle}>
					<FontAwesomeIcon icon={faBars} />
				</div>
				<div className='running-order-view__inspector-drawer__tabs'>
					<div className={ClassNames('running-order-view__inspector-drawer__tabs__tab', {
						'selected': this.state.selectedTab === InspectorPanelTabs.ADLIB
					})} onClick={(e) => this.switchTab(InspectorPanelTabs.ADLIB)} tabIndex={0}>{t('AdLib')}</div>
					<div className={ClassNames('running-order-view__inspector-drawer__tabs__tab', {
						'selected': this.state.selectedTab === InspectorPanelTabs.GLOBAL_ADLIB
					})} onClick={(e) => this.switchTab(InspectorPanelTabs.GLOBAL_ADLIB)} tabIndex={0}>{t('Global AdLib')}</div>
					<div className={ClassNames('running-order-view__inspector-drawer__tabs__tab', {
						'selected': this.state.selectedTab === InspectorPanelTabs.SYSTEM_HOTKEYS
					})} onClick={(e) => this.switchTab(InspectorPanelTabs.SYSTEM_HOTKEYS)} tabIndex={0}>{t('Shortcuts')}</div>
				</div>
				<div className='running-order-view__inspector-drawer__panel super-dark'>
					<AdLibPanel visible={this.state.selectedTab === InspectorPanelTabs.ADLIB} {...this.props}></AdLibPanel>
					<GlobalAdLibPanel visible={this.state.selectedTab === InspectorPanelTabs.GLOBAL_ADLIB} {...this.props}></GlobalAdLibPanel>
					<HotkeyHelpPanel visible={this.state.selectedTab === InspectorPanelTabs.SYSTEM_HOTKEYS} {...this.props}></HotkeyHelpPanel>
				</div>
			</div>
		)
	}
})

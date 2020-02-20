import * as React from 'react'
import { translate } from 'react-i18next'

import * as ClassNames from 'classnames'
import * as _ from 'underscore'
import * as mousetrap from 'mousetrap'

import * as faBars from '@fortawesome/fontawesome-free-solid/faBars'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

import { AdLibPanel } from './AdLibPanel'
import { GlobalAdLibPanel } from './GlobalAdLibPanel'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { SegmentUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { Rundown } from '../../../lib/collections/Rundowns'
import { RundownViewKbdShortcuts } from '../RundownView'
import { HotkeyHelpPanel } from './HotkeyHelpPanel'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { getElementDocumentOffset } from '../../utils/positions'
import { RundownLayout, RundownLayoutBase, RundownLayoutType, DashboardLayout, DashboardLayoutFilter, DashboardLayoutActionButton } from '../../../lib/collections/RundownLayouts'
import { OverflowingContainer } from './OverflowingContainer'
import { UIStateStorage } from '../../lib/UIStateStorage'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { DashboardPanel } from './DashboardPanel'
import { ensureHasTrailingSlash } from '../../lib/lib'
import { ErrorBoundary } from '../../lib/ErrorBoundary'
import { DashboardActionButton } from './DashboardActionButton';
import { DashboardActionButtonGroup } from './DashboardActionButtonGroup';

export enum ShelfTabs {
	ADLIB = 'adlib',
	ADLIB_LAYOUT_FILTER = 'adlib_layout_filter',
	GLOBAL_ADLIB = 'global_adlib',
	SYSTEM_HOTKEYS = 'system_hotkeys'
}
export interface ShelfProps {
	isExpanded: boolean
	segments: Array<SegmentUi>
	liveSegment?: SegmentUi
	rundown: Rundown
	showStyleBase: ShowStyleBase
	studioMode: boolean
	hotkeys: Array<{
		key: string
		label: string
	}>
	rundownLayout?: RundownLayoutBase
	fullViewport?: boolean

	onChangeExpanded: (value: boolean) => void
	onRegisterHotkeys: (hotkeys: Array<{
		key: string
		label: string
	}>) => void
	onChangeBottomMargin?: (newBottomMargin: string) => void
}

interface IState {
	shelfHeight: string
	overrideHeight: number | undefined
	moving: boolean
	selectedTab: string | undefined
	shouldQueue: boolean
}

const CLOSE_MARGIN = 45
const DEFAULT_TAB = ShelfTabs.ADLIB

export class ShelfBase extends React.Component<Translated<ShelfProps>, IState> {
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

	constructor (props: Translated<ShelfProps>) {
		super(props)

		this.state = {
			moving: false,
			shelfHeight: localStorage.getItem('rundownView.shelf.shelfHeight') || '50vh',
			overrideHeight: undefined,
			selectedTab: UIStateStorage.getItem(`rundownView.${props.rundown._id}`, 'shelfTab', undefined) as (string | undefined),
			shouldQueue: false
		}

		const { t } = props

		this.bindKeys = [
			{
				key: RundownViewKbdShortcuts.RUNDOWN_TOGGLE_SHELF,
				up: this.keyToggleShelf,
				label: t('Toggle Shelf')
			},
			// {
			// 	key: RundownViewKbdShortcuts.RUNDOWN_RESET_FOCUS,
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
		this.restoreDefaultTab()
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

	componentDidUpdate (prevProps: ShelfProps, prevState: IState) {
		if ((prevProps.isExpanded !== this.props.isExpanded) || (prevState.shelfHeight !== this.state.shelfHeight)) {
			if (this.props.onChangeBottomMargin && typeof this.props.onChangeBottomMargin === 'function') {
				// console.log(this.state.expanded, this.getHeight())
				this.props.onChangeBottomMargin(this.getHeight() || '0px')
			}
		}

		this.restoreDefaultTab()
	}

	restoreDefaultTab () {
		if (this.state.selectedTab === undefined && this.props.rundownLayout && RundownLayoutsAPI.isRundownLayout(this.props.rundownLayout)) {
			const defaultTab = this.props.rundownLayout.filters.find(i => i.default)
			if (defaultTab) {
				this.setState({
					selectedTab: `${ShelfTabs.ADLIB_LAYOUT_FILTER}_${defaultTab._id}`
				})
			}
		}
	}

	getHeight (): string {
		const top = parseFloat(this.state.shelfHeight.substr(0, this.state.shelfHeight.length - 2))
		return this.props.isExpanded ? (100 - top).toString() + 'vh' : '0px'
	}

	getTop (newState?: boolean): string | undefined {
		return this.state.overrideHeight ?
			((this.state.overrideHeight / window.innerHeight) * 100) + 'vh' :
			((newState !== undefined ? newState : this.props.isExpanded) ?
				this.state.shelfHeight
				:
				undefined)
	}

	getStyle () {
		return {
			'top': this.getTop(),
			'transition': this.state.moving ? '' : '0.5s top ease-out'
		}
	}

	keyBlurActiveElement = () => {
		this.blurActiveElement()
	}

	keyToggleShelf = () => {
		this.toggleShelf()
	}

	blurActiveElement = () => {
		try {
			// @ts-ignore
			document.activeElement.blur()
		} catch (e) {
			// do nothing
		}
	}

	toggleShelf = () => {
		this.blurActiveElement()
		this.props.onChangeExpanded(!this.props.isExpanded)
	}

	dropHandle = (e: MouseEvent) => {
		document.removeEventListener('mouseup', this.dropHandle)
		document.removeEventListener('mouseleave', this.dropHandle)
		document.removeEventListener('mousemove', this.dragHandle)

		this.endResize()

		e.preventDefault()
	}

	dragHandle = (e: MouseEvent) => {
		this.setState({
			overrideHeight: e.clientY + this._mouseOffset.y
		})

		e.preventDefault()
	}

	grabHandle = (e: React.MouseEvent<HTMLDivElement>) => {
		document.addEventListener('mouseup', this.dropHandle)
		document.addEventListener('mouseleave', this.dropHandle)
		document.addEventListener('mousemove', this.dragHandle)

		this.beginResize(e.clientX, e.clientY, e.currentTarget)

		e.preventDefault()
	}

	touchMoveHandle = (e: TouchEvent) => {
		this.setState({
			overrideHeight: e.touches[0].clientY + this._mouseOffset.y
		})

		e.preventDefault()
	}

	touchOffHandle = (e: TouchEvent) => {
		document.removeEventListener('touchmove', this.touchMoveHandle)
		document.removeEventListener('touchcancel', this.touchOffHandle)
		document.removeEventListener('touchend', this.touchOffHandle)

		this.endResize()

		e.preventDefault()
	}

	touchOnHandle = (e: React.TouchEvent<HTMLDivElement>) => {
		document.addEventListener('touchmove', this.touchMoveHandle, {
			passive: false
		})
		document.addEventListener('touchcancel', this.touchOffHandle)
		document.addEventListener('touchend', this.touchOffHandle, {
			passive: false
		})

		if (e.touches.length > 1) {
			this.touchOffHandle(e.nativeEvent)
			return
		}

		this.beginResize(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget)

		e.preventDefault()
	}

	endResize = () => {
		let stateChange = {
			moving: false,
			overrideHeight: undefined
		}

		let shouldBeExpanded: boolean = false

		if (Date.now() - this._mouseDown > 350) {
			if (this.state.overrideHeight && (window.innerHeight - this.state.overrideHeight > CLOSE_MARGIN)) {
				stateChange = _.extend(stateChange, {
					shelfHeight: (Math.max(0.1, 0, this.state.overrideHeight / window.innerHeight) * 100) + 'vh',
				})
				shouldBeExpanded = true
			} else {
				shouldBeExpanded = false
			}
		} else {
			shouldBeExpanded = !this.props.isExpanded
		}

		this.setState(stateChange)
		this.props.onChangeExpanded(shouldBeExpanded)
		this.blurActiveElement()

		localStorage.setItem('rundownView.shelf.shelfHeight', this.state.shelfHeight)
	}

	beginResize = (x: number, y: number, targetElement: HTMLElement) => {
		this._mouseStart.x = x
		this._mouseStart.y = y

		const handlePosition = getElementDocumentOffset(targetElement.parentElement)
		if (handlePosition) {
			this._mouseOffset.x = (handlePosition.left - window.scrollX) - this._mouseStart.x
			this._mouseOffset.y = (handlePosition.top - window.scrollY) - this._mouseStart.y
			debugger
		}

		this._mouseDown = Date.now()

		this.setState({
			moving: true
		})
	}

	switchTab (tab: string) {
		this.setState({
			selectedTab: tab
		})

		UIStateStorage.setItem(`rundownView.${this.props.rundown._id}`, 'shelfTab', tab)
	}

	renderRundownLayout (rundownLayout?: RundownLayout) {
		const { t } = this.props
		return <React.Fragment>
			<div className='rundown-view__shelf__tabs'>
				<OverflowingContainer className='rundown-view__shelf__tabs__tab-group'>
					<div className={ClassNames('rundown-view__shelf__tabs__tab', {
						'selected': (this.state.selectedTab || DEFAULT_TAB) === ShelfTabs.ADLIB
					})} onClick={(e) => this.switchTab(ShelfTabs.ADLIB)} tabIndex={0}>{t('AdLib')}</div>
					{rundownLayout && rundownLayout.filters
						.sort((a, b) => a.rank - b.rank)
						.map(panel =>
							<div className={ClassNames('rundown-view__shelf__tabs__tab', {
								'selected': (this.state.selectedTab || DEFAULT_TAB) === `${ShelfTabs.ADLIB_LAYOUT_FILTER}_${panel._id}`
							})}
								key={panel._id}
								onClick={(e) => this.switchTab(`${ShelfTabs.ADLIB_LAYOUT_FILTER}_${panel._id}`)} tabIndex={0}>{panel.name}</div>
						)}
				</OverflowingContainer>
				<div className={ClassNames('rundown-view__shelf__tabs__tab', {
					'selected': (this.state.selectedTab || DEFAULT_TAB) === ShelfTabs.GLOBAL_ADLIB
				})} onClick={(e) => this.switchTab(ShelfTabs.GLOBAL_ADLIB)} tabIndex={0}>{t('Global AdLib')}</div>
				<div className={ClassNames('rundown-view__shelf__tabs__tab', {
					'selected': (this.state.selectedTab || DEFAULT_TAB) === ShelfTabs.SYSTEM_HOTKEYS
				})} onClick={(e) => this.switchTab(ShelfTabs.SYSTEM_HOTKEYS)} tabIndex={0}>{t('Shortcuts')}</div>
			</div>
			<div className='rundown-view__shelf__panel super-dark'>
				<AdLibPanel
					visible={(this.state.selectedTab || DEFAULT_TAB) === ShelfTabs.ADLIB}
					registerHotkeys={true}
					{...this.props}></AdLibPanel>
				{rundownLayout && rundownLayout.filters.map(panel =>
					<AdLibPanel
						key={panel._id}
						visible={(this.state.selectedTab || DEFAULT_TAB) === `${ShelfTabs.ADLIB_LAYOUT_FILTER}_${panel._id}`}
						includeGlobalAdLibs={true}
						filter={panel}
						{...this.props}
						/>
				)}
				<GlobalAdLibPanel visible={(this.state.selectedTab || DEFAULT_TAB) === ShelfTabs.GLOBAL_ADLIB} {...this.props}></GlobalAdLibPanel>
				<HotkeyHelpPanel visible={(this.state.selectedTab || DEFAULT_TAB) === ShelfTabs.SYSTEM_HOTKEYS} {...this.props}></HotkeyHelpPanel>
			</div>
		</React.Fragment>
	}

	onChangeQueueAdLib = (shouldQueue: boolean, e: any) => {
		this.setState({
			shouldQueue
		})
	}

	renderDashboardLayout (rundownLayout: DashboardLayout) {
		const { t } = this.props
		return <div className='dashboard'>
			{rundownLayout.filters
				.sort((a, b) => a.rank - b.rank)
				.map((panel: DashboardLayoutFilter) =>
					<DashboardPanel
						key={panel._id}
						includeGlobalAdLibs={true}
						filter={panel}
						visible={true}
						registerHotkeys={panel.assignHotKeys}
						rundown={this.props.rundown}
						showStyleBase={this.props.showStyleBase}
						studioMode={this.props.studioMode}
						shouldQueue={this.state.shouldQueue}
						/>
			)}
			{rundownLayout.actionButtons &&
				<DashboardActionButtonGroup
					rundown={this.props.rundown}
					buttons={rundownLayout.actionButtons}
					studioMode={this.props.studioMode} />}
		</div>
	}

	render () {
		const { t, fullViewport } = this.props
		return (
			<div className={ClassNames('rundown-view__shelf dark', {
				'full-viewport': fullViewport
			})} style={fullViewport ? undefined : this.getStyle()}>
				{ !fullViewport && <div className='rundown-view__shelf__handle dark' tabIndex={0} onMouseDown={this.grabHandle} onTouchStart={this.touchOnHandle}>
					<FontAwesomeIcon icon={faBars} />
				</div>}
				<ErrorBoundary>
				{
					(this.props.rundownLayout && RundownLayoutsAPI.isRundownLayout(this.props.rundownLayout)) ?
						this.renderRundownLayout(this.props.rundownLayout) :
					(this.props.rundownLayout && RundownLayoutsAPI.isDashboardLayout(this.props.rundownLayout)) ?
						this.renderDashboardLayout(this.props.rundownLayout) :
						// ultimate fallback if not found
						this.renderRundownLayout()
				}
				</ErrorBoundary>
			</div>
		)
	}
}

export const Shelf = translate(undefined, {
	withRef: true
})(ShelfBase)

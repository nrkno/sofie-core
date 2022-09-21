import * as React from 'react'
import { withTranslation } from 'react-i18next'

import ClassNames from 'classnames'

import { faBars } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { PieceUi } from '../SegmentTimeline/SegmentTimelineContainer'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'
import { getElementDocumentOffset } from '../../utils/positions'
import { RundownLayoutFilter, RundownLayoutShelfBase } from '../../../lib/collections/RundownLayouts'
import { UIStateStorage } from '../../lib/UIStateStorage'
import { RundownLayoutsAPI } from '../../../lib/api/rundownLayouts'
import { contextMenuHoldToDisplayTime } from '../../lib/lib'
import { ErrorBoundary } from '../../lib/ErrorBoundary'
import { ShelfRundownLayout } from './ShelfRundownLayout'
import { ShelfDashboardLayout } from './ShelfDashboardLayout'
import { Bucket } from '../../../lib/collections/Buckets'
import { RundownViewBuckets, BucketAdLibItem } from './RundownViewBuckets'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { ShelfInspector } from './Inspector/ShelfInspector'
import { Studio } from '../../../lib/collections/Studios'
import RundownViewEventBus, {
	IEventContext,
	RundownViewEvents,
	SelectPieceEvent,
	ShelfStateEvent,
	SwitchToShelfTabEvent,
} from '../RundownView/RundownViewEventBus'
import { IAdLibListItem } from './AdLibListItem'
import ShelfContextMenu from './ShelfContextMenu'
import { doUserAction, UserAction } from '../../lib/userAction'
import { MeteorCall } from '../../../lib/api/methods'
import { Rundown } from '../../../lib/collections/Rundowns'
import { ShowStyleVariant } from '../../../lib/collections/ShowStyleVariants'

export enum ShelfTabs {
	ADLIB = 'adlib',
	ADLIB_LAYOUT_FILTER = 'adlib_layout_filter',
	GLOBAL_ADLIB = 'global_adlib',
	SYSTEM_HOTKEYS = 'system_hotkeys',
}
export interface IShelfProps extends React.ComponentPropsWithRef<any> {
	isExpanded: boolean
	buckets: Array<Bucket>
	playlist: RundownPlaylist
	currentRundown: Rundown
	studio: Studio
	showStyleBase: ShowStyleBase
	showStyleVariant: ShowStyleVariant
	studioMode: boolean
	hotkeys: Array<{
		key: string
		label: string
	}>
	rundownLayout?: RundownLayoutShelfBase
	fullViewport?: boolean
	shelfDisplayOptions: {
		buckets: boolean
		layout: boolean
		inspector: boolean
	}
	bucketDisplayFilter: number[] | undefined
	showBuckets: boolean
	showInspector: boolean

	onChangeExpanded: (value: boolean) => void
	onChangeBottomMargin?: (newBottomMargin: string) => void
}

interface IState {
	shelfHeight: string
	overrideHeight: number | undefined
	moving: boolean
	selectedTab: string | undefined
	shouldQueue: boolean
	selectedPiece: BucketAdLibItem | IAdLibListItem | PieceUi | undefined
	localStorageName: string
}

const CLOSE_MARGIN = 45
const MAX_HEIGHT = 95
export const DEFAULT_TAB = ShelfTabs.ADLIB

export class ShelfBase extends React.Component<Translated<IShelfProps>, IState> {
	private _mouseStart: {
		x: number
		y: number
	} = {
		x: 0,
		y: 0,
	}
	private _mouseOffset: {
		x: number
		y: number
	} = {
		x: 0,
		y: 0,
	}
	private _mouseDown: number

	constructor(props: Translated<IShelfProps>) {
		super(props)

		const defaultHeight = props.rundownLayout?.startingHeight
			? `${100 - Math.min(props.rundownLayout.startingHeight, MAX_HEIGHT)}vh`
			: '50vh'

		const localStorageName = props.rundownLayout ? `rundownView.shelf_${props.rundownLayout._id}` : `rundownView.shelf`

		this.state = {
			moving: false,
			shelfHeight: localStorage.getItem(`${localStorageName}.shelfHeight`) ?? defaultHeight,
			overrideHeight: undefined,
			selectedTab: UIStateStorage.getItem(`rundownView.${props.playlist._id}`, 'shelfTab', undefined) as
				| string
				| undefined,
			shouldQueue: false,
			selectedPiece: undefined,
			localStorageName,
		}
	}

	onTake = (e: IEventContext) => {
		this.take(e.context)
	}

	take = (e: any) => {
		const { t } = this.props
		if (this.props.studioMode) {
			doUserAction(t, e, UserAction.TAKE, (e, ts) =>
				MeteorCall.userAction.take(e, ts, this.props.playlist._id, this.props.playlist.currentPartInstanceId)
			)
		}
	}

	componentDidMount() {
		this.restoreDefaultTab()

		RundownViewEventBus.on(RundownViewEvents.SWITCH_SHELF_TAB, this.onSwitchShelfTab)
		RundownViewEventBus.on(RundownViewEvents.SELECT_PIECE, this.onSelectPiece)
		RundownViewEventBus.on(RundownViewEvents.SHELF_STATE, this.onShelfStateChange)

		if (this.props.fullViewport) {
			RundownViewEventBus.on(RundownViewEvents.TAKE, this.onTake)
		}
	}

	componentWillUnmount() {
		RundownViewEventBus.off(RundownViewEvents.SWITCH_SHELF_TAB, this.onSwitchShelfTab)
		RundownViewEventBus.off(RundownViewEvents.SELECT_PIECE, this.onSelectPiece)
		RundownViewEventBus.off(RundownViewEvents.SHELF_STATE, this.onShelfStateChange)

		if (this.props.fullViewport) {
			RundownViewEventBus.off(RundownViewEvents.TAKE, this.onTake)
		}
	}

	componentDidUpdate(prevProps: IShelfProps, prevState: IState) {
		if (prevProps.isExpanded !== this.props.isExpanded || prevState.shelfHeight !== this.state.shelfHeight) {
			if (this.props.onChangeBottomMargin && typeof this.props.onChangeBottomMargin === 'function') {
				this.props.onChangeBottomMargin(this.getHeight() || '0px')
			}
		}

		this.restoreDefaultTab()
	}

	restoreDefaultTab() {
		if (
			this.state.selectedTab === undefined &&
			this.props.rundownLayout &&
			RundownLayoutsAPI.isRundownLayout(this.props.rundownLayout)
		) {
			const defaultTab = this.props.rundownLayout.filters.find((i) => (i as RundownLayoutFilter).default)
			if (defaultTab) {
				this.setState({
					selectedTab: `${ShelfTabs.ADLIB_LAYOUT_FILTER}_${defaultTab._id}`,
				})
			} else if (this.props.rundownLayout.filters.length > 0) {
				// there is no AdLib tab so some default needs to be selected
				this.setState({
					selectedTab: `${ShelfTabs.ADLIB_LAYOUT_FILTER}_${this.props.rundownLayout.filters[0]._id}`,
				})
			}
		}
	}

	getHeight(): string {
		const top = parseFloat(this.state.shelfHeight.substr(0, this.state.shelfHeight.length - 2))
		return this.props.isExpanded ? (100 - top).toString() + 'vh' : '0px'
	}

	getTop(newState?: boolean): string | undefined {
		return this.state.overrideHeight
			? (this.state.overrideHeight / window.innerHeight) * 100 + 'vh'
			: (newState !== undefined ? newState : this.props.isExpanded)
			? this.state.shelfHeight
			: undefined
	}

	getStyle() {
		return {
			top: this.getTop(),
			transition: this.state.moving ? '' : '0.5s top ease-out',
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
		if (e.buttons !== 1) {
			this.dropHandle(e)
			return
		}

		this.setState({
			overrideHeight: e.clientY + this._mouseOffset.y,
		})

		e.preventDefault()
	}

	grabHandle = (e: React.MouseEvent<HTMLDivElement>) => {
		if (e.button !== 0) {
			return
		}

		document.addEventListener('mouseup', this.dropHandle)
		document.addEventListener('mouseleave', this.dropHandle)
		document.addEventListener('mousemove', this.dragHandle)

		this.beginResize(e.clientX, e.clientY, e.currentTarget)

		e.preventDefault()
	}

	touchMoveHandle = (e: TouchEvent) => {
		this.setState({
			overrideHeight: e.touches[0].clientY + this._mouseOffset.y,
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
			passive: false,
		})
		document.addEventListener('touchcancel', this.touchOffHandle)
		document.addEventListener('touchend', this.touchOffHandle, {
			passive: false,
		})

		if (e.touches.length > 1) {
			this.touchOffHandle(e.nativeEvent)
			return
		}

		this.beginResize(e.touches[0].clientX, e.touches[0].clientY, e.currentTarget)

		e.preventDefault()
	}

	endResize = () => {
		const stateChange: Partial<IState> = {
			moving: false,
			overrideHeight: undefined,
		}

		let shouldBeExpanded: boolean = false

		if (Date.now() - this._mouseDown > 350) {
			if (this.state.overrideHeight && window.innerHeight - this.state.overrideHeight > CLOSE_MARGIN) {
				stateChange.shelfHeight = Math.max(0.1, 0, this.state.overrideHeight / window.innerHeight) * 100 + 'vh'
				shouldBeExpanded = true
			} else {
				shouldBeExpanded = false
			}
		} else {
			shouldBeExpanded = !this.props.isExpanded
		}

		this.setState(stateChange as any)

		document.body.style.cursor = ''

		this.props.onChangeExpanded(shouldBeExpanded)
		this.blurActiveElement()

		localStorage.setItem(`${this.state.localStorageName}.shelfHeight`, this.state.shelfHeight)
	}

	beginResize = (x: number, y: number, targetElement: HTMLElement) => {
		this._mouseStart.x = x
		this._mouseStart.y = y

		const handlePosition = getElementDocumentOffset(targetElement.parentElement)
		if (handlePosition) {
			this._mouseOffset.x = handlePosition.left - window.scrollX - this._mouseStart.x
			this._mouseOffset.y = handlePosition.top - window.scrollY - this._mouseStart.y
		}

		this._mouseDown = Date.now()

		document.body.style.cursor = 'grabbing'

		this.setState({
			moving: true,
		})
	}

	onShelfStateChange = (e: ShelfStateEvent) => {
		this.blurActiveElement()
		this.props.onChangeExpanded(e.state === 'toggle' ? !this.props.isExpanded : e.state)
	}

	onSwitchShelfTab = (e: SwitchToShelfTabEvent) => {
		if (e.tab) {
			this.switchTab(e.tab)
		}
	}

	switchTab = (tab: string) => {
		this.setState({
			selectedTab: tab,
		})

		UIStateStorage.setItem(`rundownView.${this.props.playlist._id}`, 'shelfTab', tab)
	}

	private onSelectPiece = (e: SelectPieceEvent) => {
		this.selectPiece(e.piece)
	}

	selectPiece = (piece: BucketAdLibItem | IAdLibListItem | PieceUi | undefined) => {
		this.setState({
			selectedPiece: piece,
		})
	}

	changeQueueAdLib = (shouldQueue: boolean) => {
		this.setState({
			shouldQueue,
		})
	}

	render() {
		const { fullViewport, shelfDisplayOptions } = this.props
		return (
			<div
				className={ClassNames('rundown-view__shelf dark', {
					'scroll-sink': !fullViewport,
					'full-viewport': fullViewport,
					moving: this.state.moving,
				})}
				style={fullViewport ? undefined : this.getStyle()}
			>
				{!this.props.rundownLayout?.disableContextMenu && <ShelfContextMenu />}
				{!fullViewport && (
					<div
						className="rundown-view__shelf__handle dark"
						tabIndex={0}
						onMouseDown={this.grabHandle}
						onTouchStart={this.touchOnHandle}
					>
						<FontAwesomeIcon icon={faBars} />
					</div>
				)}
				<div className="rundown-view__shelf__contents">
					{shelfDisplayOptions.layout ? (
						<ContextMenuTrigger
							id="shelf-context-menu"
							attributes={{
								className: 'rundown-view__shelf__contents__pane fill',
							}}
							holdToDisplay={contextMenuHoldToDisplayTime()}
						>
							<ErrorBoundary>
								{this.props.rundownLayout && RundownLayoutsAPI.isRundownLayout(this.props.rundownLayout) ? (
									<ShelfRundownLayout
										playlist={this.props.playlist}
										showStyleBase={this.props.showStyleBase}
										studioMode={this.props.studioMode}
										hotkeys={this.props.hotkeys}
										rundownLayout={this.props.rundownLayout}
										selectedTab={this.state.selectedTab}
										selectedPiece={this.state.selectedPiece}
										onSelectPiece={this.selectPiece}
										onSwitchTab={this.switchTab}
										studio={this.props.studio}
									/>
								) : this.props.rundownLayout && RundownLayoutsAPI.isDashboardLayout(this.props.rundownLayout) ? (
									<ShelfDashboardLayout
										playlist={this.props.playlist}
										showStyleBase={this.props.showStyleBase}
										showStyleVariant={this.props.showStyleVariant}
										// buckets={this.props.buckets}
										studioMode={this.props.studioMode}
										rundownLayout={this.props.rundownLayout}
										shouldQueue={this.state.shouldQueue}
										selectedPiece={this.state.selectedPiece}
										onSelectPiece={this.selectPiece}
										onChangeQueueAdLib={this.changeQueueAdLib}
										studio={this.props.studio}
									/>
								) : (
									// ultimate fallback if not found
									<ShelfRundownLayout
										playlist={this.props.playlist}
										showStyleBase={this.props.showStyleBase}
										studioMode={this.props.studioMode}
										hotkeys={this.props.hotkeys}
										rundownLayout={undefined}
										selectedTab={this.state.selectedTab}
										selectedPiece={this.state.selectedPiece}
										onSelectPiece={this.selectPiece}
										onSwitchTab={this.switchTab}
										studio={this.props.studio}
									/>
								)}
							</ErrorBoundary>
						</ContextMenuTrigger>
					) : null}
					{shelfDisplayOptions.buckets ? (
						<ErrorBoundary>
							<RundownViewBuckets
								buckets={this.props.buckets}
								playlist={this.props.playlist}
								shouldQueue={this.state.shouldQueue}
								showStyleBase={this.props.showStyleBase}
								fullViewport={
									!!this.props.fullViewport &&
									this.props.shelfDisplayOptions.buckets === true &&
									this.props.shelfDisplayOptions.inspector === false &&
									this.props.shelfDisplayOptions.layout === false
								}
								displayBuckets={this.props.bucketDisplayFilter}
								selectedPiece={this.state.selectedPiece}
								onSelectPiece={this.selectPiece}
							/>
						</ErrorBoundary>
					) : null}
					{shelfDisplayOptions.inspector && this.props.rundownLayout?.showInspector ? (
						<ErrorBoundary>
							<ShelfInspector
								selected={this.state.selectedPiece}
								showStyleBase={this.props.showStyleBase}
								studio={this.props.studio}
								rundownPlaylist={this.props.playlist}
								onSelectPiece={this.selectPiece}
							/>
						</ErrorBoundary>
					) : null}
				</div>
			</div>
		)
	}
}

export const Shelf = withTranslation(undefined, {
	withRef: true,
})(ShelfBase)

import * as React from 'react'
import * as $ from 'jquery'
import * as _ from 'underscore'
import * as ClassNames from 'classnames'
import {
	Route
} from 'react-router-dom'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { RunningOrder, RunningOrders } from '../../../lib/collections/RunningOrders'
import { StudioInstallations, StudioInstallation } from '../../../lib/collections/StudioInstallations'
import { parse as queryStringParse } from 'query-string'

import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { objectPathGet } from '../../../lib/lib'
import { SegmentLines } from '../../../lib/collections/SegmentLines'
import { PrompterData, PrompterAPI } from '../../../lib/api/prompter'
import * as classNames from 'classnames'
import { Segments } from '../../../lib/collections/Segments'
import { Tracker } from 'meteor/tracker'
import { PrompterControlManager } from './controller/manager'
import { Meteor } from 'meteor/meteor'

interface PrompterConfig {
	mirror?: boolean
	mirrorv?: boolean

	restrictMode?: string
	followTake?: boolean
	fontSize?: number
	margin?: number

	marker?: 'center' | 'top' | 'bottom' | 'hide'
}
interface IProps {
	match?: {
		params?: {
			studioId: string
		}
	}
}
interface ITrackedProps {
	runningOrder?: RunningOrder
	studioInstallation?: StudioInstallation
	studioId?: string
	// isReady: boolean
}
interface IState {
	subsReady: boolean
}
export class PrompterViewInner extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	usedHotkeys: Array<string> = []

	isMounted0: boolean = false
	animatePreviousTime: number = 0

	scrollDirection: number = 0
	scrollSpeed: number = window.innerHeight * 2 // px per second
	scrollSpeedMultiplier: number = 1

	autoScrollPreviousSegmentLineId: string | null = null

	scrollDirection2: number = 0

	autorun0: Tracker.Computation | undefined

	configOptions: PrompterConfig

	private _controller: PrompterControlManager

	private checkWindowScroll: number | null = null

	constructor (props) {
		super(props)
		this.state = {
			subsReady: false
		}
		// Disable the context menu:
		document.addEventListener('contextmenu', (e) => {
			e.preventDefault()
		})

		const queryParams = queryStringParse(location.search)

		this.configOptions = {
			mirror: queryParams['mirror'] === '1',
			mirrorv: queryParams['mirrorv'] === '1',
			restrictMode: queryParams['mode'] || undefined,
			followTake: ( queryParams['followtake'] === undefined ? true : queryParams['followtake'] === '1'),
			fontSize: parseInt(queryParams['fontsize'], 10) || undefined,
			margin: parseInt(queryParams['margin'], 10) || undefined,

			marker: queryParams['marker']
		}

		this._controller = new PrompterControlManager(this)
	}

	componentWillMount () {
		this.subscribe('runningOrders', _.extend({
			active: true
		}, this.props.studioId ? {
			studioInstallationId: this.props.studioId
		} : {}))
		if (this.props.studioId) {
			this.subscribe('studioInstallations', {
				_id: this.props.studioId
			})
		}
		this.autorun(() => {
			let subsReady = this.subscriptionsReady()
			if (subsReady !== this.state.subsReady) {
				this.setState({
					subsReady: subsReady
				})
			}
		})
	}

	componentDidUpdate () {
		$(document.body).addClass(['dark', 'xdark', 'vertical-overflow-only'])
		this.triggerCheckCurrentTakeMarkers()
		this.checkScrollToCurrent()
	}
	checkScrollToCurrent () {
		let roId = this.props.runningOrder && this.props.runningOrder._id
		let runningOrder = RunningOrders.findOne(roId || '')
		if (this.configOptions.followTake ) {
			if (runningOrder) {

				if (runningOrder.currentSegmentLineId !== this.autoScrollPreviousSegmentLineId) {
					this.autoScrollPreviousSegmentLineId = runningOrder.currentSegmentLineId

					this.scrollToCurrent()
				}
			}
		}
	}
	scrollToCurrent () {
		const elementPosition = $('.prompter .current').offset()
		if (elementPosition) {
			let scrollTop = elementPosition.top // $('html,body').scrollTop()

			$('html,body').animate({
				scrollTop: Math.max(0, scrollTop)
			}, 300)
		}
	}
	scrollToNext () {
		const elementPosition = $('.prompter .next').offset()
		if (elementPosition) {
			let scrollTop = elementPosition.top // $('html,body').scrollTop()

			$('html,body').animate({
				scrollTop: Math.max(0, scrollTop)
			}, 300)
		}
	}
	findAnchorPosition (startY: number, endY: number, sortDirection: number = 1): number | null {
		let foundPositions: number[] = []
		_.find($('.prompter .scroll-anchor'), el => {
			const offset = $(el).offset()
			if (
				offset &&
				( startY === -1 || offset.top > startY ) &&
				( endY === -1 	|| offset.top <= endY )
			) {
				foundPositions.push(offset.top)
				return true
			}
		})
		foundPositions = _.sortBy(foundPositions, v => sortDirection * v)

		return foundPositions[0] || null
	}
	getScrollPosition () {
		return window.scrollY || window.pageYOffset || (document.documentElement || {scrollTop: undefined}).scrollTop
	}
	onWindowScroll = () => {
		this.triggerCheckCurrentTakeMarkers()
	}
	triggerCheckCurrentTakeMarkers = () => {
		// Rate limit:
		if (!this.checkWindowScroll) {
			this.checkWindowScroll = Meteor.setTimeout(() => {
				this.checkWindowScroll = null

				this.checkCurrentTakeMarkers()
			}, 500)
		}
	}
	checkCurrentTakeMarkers = () => {

		let roId = this.props.runningOrder && this.props.runningOrder._id
		let runningOrder = RunningOrders.findOne(roId || '')

		if (runningOrder) {

			const positionTop = this.getScrollPosition()
			const positionBottom = positionTop + window.innerHeight

			const anchors = $('.scroll-anchor')

			let currentSegmentLineElement: JQuery<HTMLElement> | null = null
			let currentSegmentLineElementAfter: JQuery<HTMLElement> | null = null
			let nextSegmentLineElement: JQuery<HTMLElement> | null = null
			let nextSegmentLineElementAfter: JQuery<HTMLElement> | null = null

			for (let i = 0; i < anchors.length; i++) {
				const el = anchors[i]
				const next = anchors[i + 1]

				if (runningOrder.currentSegmentLineId && el.className.match('.segmentLine-' + runningOrder.currentSegmentLineId ) ) {
					currentSegmentLineElement = $(el)
					currentSegmentLineElementAfter = $(next) || null
				}
				if (runningOrder.nextSegmentLineId && el.className.match('.segmentLine-' + runningOrder.nextSegmentLineId ) ) {
					nextSegmentLineElement = $(el)
					nextSegmentLineElementAfter = $(next) || null
				}
			}

			const currentPositionStart 	= currentSegmentLineElement 		? (currentSegmentLineElement.offset() 		|| {top: undefined}).top : null
			const currentPositionEnd 	= currentSegmentLineElementAfter 	? (currentSegmentLineElementAfter.offset() 	|| {top: undefined}).top : null

			const nextPositionStart 	= nextSegmentLineElement 			? (nextSegmentLineElement.offset() 		|| {top: undefined}).top : null
			const nextPositionEnd 		= nextSegmentLineElementAfter 		? (nextSegmentLineElementAfter.offset() 	|| {top: undefined}).top : null

			if (currentPositionEnd && currentPositionEnd < positionTop) {
				// Display take "^" indicator
				$('.take-indicator').toggleClass('hidden', false).toggleClass('top', true)
			} else if (currentPositionStart && currentPositionStart > positionBottom) {
				// Display take "v" indicator
				$('.take-indicator').toggleClass('hidden', false).toggleClass('top', false)
			} else {
				$('.take-indicator').toggleClass('hidden', true)
			}

			if (nextPositionEnd && nextPositionEnd < positionTop) {
				// Display next "^" indicator
				$('.next-indicator').toggleClass('hidden', false).toggleClass('top', true)
			// } else if (nextPositionStart && nextPositionStart > positionBottom) {
				// Don't display next "v" indicator
				// $('.next-indicator').toggleClass('hidden', false).toggleClass('top', false)
			} else {
				$('.next-indicator').toggleClass('hidden', true)
			}
		}
	}

	componentDidMount () {
		$(document.body).addClass(['dark', 'vertical-overflow-only'])
		window.addEventListener('scroll', this.onWindowScroll)
		this.isMounted0 = true

		this.triggerCheckCurrentTakeMarkers()
		this.checkScrollToCurrent()
	}
	componentWillUnmount () {
		super.componentWillUnmount()

		$(document.body).removeClass(['dark', 'vertical-overflow-only'])
		window.removeEventListener('scroll', this.onWindowScroll)
		this.isMounted0 = false

	}

	renderMessage (message: string) {
		const { t } = this.props

		return (
			<div className='running-order-view running-order-view--unpublished'>
				<div className='running-order-view__label'>
					<p>
						{message}
					</p>
					<p>
						<Route render={({ history }) => (
							<button className='btn btn-primary' onClick={() => { history.push('/runningOrders') }}>
								{t('Return to list')}
							</button>
						)} />
					</p>
				</div>
			</div>
		)
	}

	render () {
		const { t } = this.props

		return <React.Fragment>
			{/* <NotificationCenterPanel /> */}

			{
				!this.state.subsReady ?
					<div className='running-order-view running-order-view--loading' >
						<Spinner />
					</div> :
				(
					this.props.runningOrder ?
						<Prompter runningOrderId={this.props.runningOrder._id} config={this.configOptions} /> :
					this.props.studioInstallation ?
						this.renderMessage(t('There is no running order active in this studio.')) :
					this.props.studioId ?
						this.renderMessage(t('This studio doesn\'t exist.')) :
					this.renderMessage(t('There are no active running orders.'))
				)
			}
		</React.Fragment>
	}
}
export const PrompterView = translateWithTracker<IProps, {}, ITrackedProps>((props: IProps) => {

	let studioId = objectPathGet(props, 'match.params.studioId')
	let studioInstallationSubscription
	let studioInstallation
	if (studioId) {
		studioInstallation = StudioInstallations.findOne(studioId)
	}
	const runningOrder = RunningOrders.findOne(_.extend({
		active: true
	}, {
		studioInstallationId: studioId
	}))

	return {
		runningOrder,
		studioInstallation,
		studioId,
		// isReady: runningOrderSubscription.ready() && (studioInstallationSubscription ? studioInstallationSubscription.ready() : true)
	}
})(PrompterViewInner)

interface IPrompterProps {
	runningOrderId: string
	config: PrompterConfig
}
interface IPrompterTrackedProps {
	runningOrder: RunningOrder | undefined,
	currentSegmentLineId: string,
	nextSegmentLineId: string,
	prompterData: PrompterData
}
interface IPrompterState {
	subsReady: boolean
}
export const Prompter = translateWithTracker<IPrompterProps, {}, IPrompterTrackedProps>((props: IPrompterProps) => {

	const runningOrder = RunningOrders.findOne(props.runningOrderId)

	let prompterData = PrompterAPI.getPrompterData(props.runningOrderId)

	return {
		runningOrder: runningOrder,
		currentSegmentLineId: runningOrder && runningOrder.currentSegmentLineId || '',
		nextSegmentLineId: runningOrder && runningOrder.nextSegmentLineId || '',
		prompterData
	}
})(class Prompter extends MeteorReactComponent<Translated<IPrompterProps & IPrompterTrackedProps>, IPrompterState> {

	constructor (props) {
		super(props)
		this.state = {
			subsReady: false
		}
	}
	componentWillUnmount () {
		super.componentWillUnmount()
	}
	componentWillMount () {

		this.subscribe('runningOrders', 	{_id: 				this.props.runningOrderId})
		this.subscribe('segments', 			{runningOrderId: 	this.props.runningOrderId})
		this.subscribe('segmentLines', 		{runningOrderId: 	this.props.runningOrderId})
		this.subscribe('segmentLineItems', 	{runningOrderId: 	this.props.runningOrderId})

	}

	renderPrompterData (prompterData: PrompterData) {

		let divs: any[] = []
		let previousSegmentId = ''
		let previousSegmentLineId = ''
		_.each(prompterData.lines, (line, i: number) => {

			let currentNextLine: 'current' | 'next' | null = null

			currentNextLine = (
				this.props.currentSegmentLineId === line.segmentLineId ? 'current' :
				this.props.nextSegmentLineId 	=== line.segmentLineId ? 'next' :
				null
			)

			if (line.segmentId !== previousSegmentId) {
				let segment = Segments.findOne(line.segmentId)

				divs.push(
					<div
						key={'segment_' + i}
						className={classNames(
							'prompter-segment',
							'scroll-anchor',
							'segment-' + line.segmentId,
							'segmentLine-' + line.segmentLineId,
							currentNextLine
						)}
					>
						{ segment ? segment.name : 'N/A' }
					</div>
				)
			} else if (line.segmentLineId !== previousSegmentLineId) {

				let segmentLine = SegmentLines.findOne(line.segmentLineId)
				let title: string = segmentLine ? segmentLine.slug : 'N/A'
				title = title.replace(/.*;/, '') // DIREKTE PUNKT FESTIVAL;Split

				divs.push(
					<div
						key={'segmentLine_' + i}
						className={classNames(
							'prompter-segmentLine',
							'scroll-anchor',
							'segmentLine-' + line.segmentLineId,
							currentNextLine
						)}
					>
						{title}
					</div>
				)
			}
			previousSegmentId = line.segmentId
			previousSegmentLineId = line.segmentLineId

			divs.push(
				<div
					key={i}
					className={classNames(
						'prompter-line',
						(!line.text ? 'empty' : undefined)
					)}
				>
					{line.text || ''}
				</div>
			)
		})
		return divs
	}
	render () {
		const { t } = this.props

		if (this.props.prompterData && this.props.runningOrder) {
			return (
				<div
					className={ClassNames('prompter', this.props.config.mirror ? 'mirror' : undefined, this.props.config.mirrorv ? 'mirrorv' : undefined)}
					style={{
						fontSize:		(this.props.config.fontSize ? this.props.config.fontSize + 'vh' : undefined),
						marginLeft:		(this.props.config.margin ? this.props.config.margin + 'vw' : undefined),
						marginRight:	(this.props.config.margin ? this.props.config.margin + 'vw' : undefined),
						marginTop:		(this.props.config.margin ? this.props.config.margin + 'vh' : undefined),
						marginBottom:	(this.props.config.margin ? this.props.config.margin + 'vh' : undefined)
					}}
				>
					<div className='overlay-fix'>
						<div className={'read-marker ' + ( this.props.config.marker || 'hide' )}>
							<div className='side left'></div>
							<div className='side right'></div>
						</div>

						<div className='take-indicator hidden'></div>
						<div className='next-indicator hidden'></div>
					</div>

					<div className='prompter-break begin'>
						{this.props.runningOrder.name}
					</div>

					{this.renderPrompterData(this.props.prompterData)}

					{
						this.props.prompterData.lines.length ?
						<div className='prompter-break end'>
							-{t('End of script')}-
						</div> : null
					}
				</div >
			)
		} else {
			return (
				<div className='prompter prompter--loading' >
					<Spinner />
				</div >
			)
		}
	}
})

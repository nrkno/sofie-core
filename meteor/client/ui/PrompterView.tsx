import * as React from 'react'
import * as $ from 'jquery'
import * as _ from 'underscore'
import {
	BrowserRouter as Router,
	Route,
	Switch,
	Redirect
} from 'react-router-dom'
import { translateWithTracker, Translated } from '../lib/ReactMeteorData/ReactMeteorData'
import { Meteor } from 'meteor/meteor'

import { RunningOrder, RunningOrders } from '../../lib/collections/RunningOrders'
import { StudioInstallations, StudioInstallation } from '../../lib/collections/StudioInstallations'

import { Spinner } from '../lib/Spinner'
import { RunningOrderView } from './RunningOrderView'
import { MeteorReactComponent } from '../lib/MeteorReactComponent'
import { objectPathGet, rateLimitIgnore } from '../../lib/lib'
import { SegmentLine, SegmentLines } from '../../lib/collections/SegmentLines'
import { SegmentLineItem, SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { PrompterMethods, PrompterData, PrompterAPI } from '../../lib/api/prompter'
import * as classNames from 'classnames'
import { Segment, Segments } from '../../lib/collections/Segments'
import { mousetrapHelper } from '../lib/moustrapHelper'
// @ts-ignore Meteor package not recognized by Typescript
import { ComputedField } from 'meteor/peerlibrary:computed-field'

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
})(class PrompterView extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	usedHotkeys: Array<string> = []

	isMounted0: boolean = false
	animatePreviousTime: number = 0

	scrollDirection: number = 0
	scrollSpeed: number = window.innerHeight * 2 // px per second
	scrollSpeedMultiplier: number = 1

	autoScroll: boolean = true
	autoScrollPreviousSegmentLineId: string | null = null

	scrollDirection2: number = 0

	autorun0: Tracker.Computation | undefined

	constructor (props) {
		super(props)
		this.state = {
			subsReady: false
		}
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
		$(document.body).addClass(['dark', 'vertical-overflow-only'])

		let roId = this.props.runningOrder && this.props.runningOrder._id
		let runningOrder = RunningOrders.findOne(roId || '')
		if (this.autoScroll) {
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

	componentDidMount () {
		$(document.body).addClass(['dark', 'vertical-overflow-only'])

		mousetrapHelper.bind('down', e => this.arrowDown(e, true), 'keydown')
		mousetrapHelper.bind('shift+down', e => this.arrowDown(e, true), 'keydown')
		mousetrapHelper.bind('down', e => this.arrowDown(e, false), 'keyup')
		mousetrapHelper.bind('shift+down', e => this.arrowDown(e, false), 'keyup')

		mousetrapHelper.bind('up', e => this.arrowUp(e, true), 'keydown')
		mousetrapHelper.bind('shift+up', e => this.arrowUp(e, true), 'keydown')
		mousetrapHelper.bind('up', e => this.arrowUp(e, false), 'keyup')
		mousetrapHelper.bind('shift+up', e => this.arrowUp(e, false), 'keyup')

		mousetrapHelper.bind('shift', e => this.shiftKey(e, true), 'keydown')
		mousetrapHelper.bind('shift', e => this.shiftKey(e, false), 'keyup')

		mousetrapHelper.bind('home', e => this.homeKey(e, false), 'keydown')
		mousetrapHelper.bind('home', e => this.homeKey(e, true), 'keyup')

		this.isMounted0 = true
		this.animate()
	}
	arrowDown = (e, keyDown: boolean) => {
		e.preventDefault()
		this.autoScroll = false
		if (keyDown) {
			this.scrollDirection = 1
		} else {
			this.scrollDirection = 0
		}
	}
	arrowUp = (e, keyDown: boolean) => {
		e.preventDefault()
		this.autoScroll = false
		if (keyDown) {
			this.scrollDirection = -1
		} else {
			this.scrollDirection = 0
		}
	}
	shiftKey = (e, keyDown: boolean) => {
		e.preventDefault()
		if (keyDown) {
			this.scrollSpeedMultiplier = 3
		} else {
			this.scrollSpeedMultiplier = 1
		}
	}
	homeKey = (e, keyDown: boolean) => {
		e.preventDefault()
		if (keyDown) {
			this.autoScroll = true
			this.scrollToCurrent()
		}
	}
	animate = () => {

		const deltaTime = (
			this.animatePreviousTime ?
			Math.min(200, Date.now() - this.animatePreviousTime) :
			1000 / 60
		)
		this.animatePreviousTime = Date.now()

		// Add a little smoothness:
		if (this.scrollDirection) {
			this.scrollDirection2 = this.scrollDirection
		} else {
			let dd = (this.scrollDirection - this.scrollDirection2)
			if (Math.abs(dd) <= 0.2) {
				this.scrollDirection2 = this.scrollDirection
			} else {
				// this.scrollDirection2 += dd * 0.1
				this.scrollDirection2 += Math.sign(dd) * 0.2
			}
		}
		// } else {
		// 	if (
		// 		this.scrollDirection &&
		// 		this.scrollDirection2 &&
		// 		Math.sign(this.scrollDirection) !== Math.sign(this.scrollDirection2)
		// 	) {
		// 		// do a sharp turn:
		// 		this.scrollDirection2 = this.scrollDirection
		// 	} else {
		// 		this.scrollDirection2 += Math.sign(dd) * 0.04
		// 	}
		// }

		if (this.scrollDirection2) {
			window.scrollBy(0, this.scrollDirection2 * this.scrollSpeed * this.scrollSpeedMultiplier * (deltaTime / 1000) )
		}

		if (this.isMounted0) {
			window.requestAnimationFrame(this.animate)
		}
	}

	componentWillUnmount () {
		super.componentWillUnmount()
		this.isMounted0 = false
		$(document.body).removeClass(['dark', 'vertical-overflow-only'])

		mousetrapHelper.unbind(this.usedHotkeys, 'keyup')
		mousetrapHelper.unbind(this.usedHotkeys, 'keydown')
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

		if (!this.state.subsReady) {
			return (
				<div className='running-order-view running-order-view--loading' >
					<Spinner />
				</div >
			)
		} else {
			if (this.props.runningOrder) {
				return <Prompter runningOrderId={this.props.runningOrder._id} />
				// return <RunningOrderView runningOrderId={this.props.runningOrder._id} inActiveROView={true} />
			} else if (this.props.studioInstallation) {
				return this.renderMessage(t('There is no running order active in this studio.'))
			} else if (this.props.studioId) {
				return this.renderMessage(t('This studio doesn\'t exist.'))
			} else {
				return this.renderMessage(t('There are no active running orders.'))
			}
		}
	}
})

interface IPrompterProps {
	runningOrderId: string
}
interface IPrompterTrackedProps {
	// runningOrder?: RunningOrder
	// segmentLines: Array<SegmentLine>
	// segmentLineItems: Array<SegmentLineItem>
	// // studioId?: string
	// // isReady: boolean
	currentSegmentLineId: string,
	nextSegmentLineId: string,
	prompterData: PrompterData
}
interface IPrompterState {
	subsReady: boolean
	// currentSegmentLineId: string,
	// nextSegmentLineId: string,
	// prompterData: PrompterData
}
export const Prompter = translateWithTracker<IPrompterProps, {}, IPrompterTrackedProps>((props: IPrompterProps) => {

	const runningOrder = RunningOrders.findOne(props.runningOrderId)
	// let lines = runningOrder && SegmentLines.find({runningOrderId: runningOrder._id}).fetch() || []
	// let items = runningOrder && SegmentLineItems.find({runningOrderId: runningOrder._id}).fetch() || []

	// rateLimitIgnore('prompterView', () => {
	let prompterData = PrompterAPI.getPrompterData(props.runningOrderId)

	return {
		currentSegmentLineId: runningOrder && runningOrder.currentSegmentLineId || '',
		nextSegmentLineId: runningOrder && runningOrder.nextSegmentLineId || '',
		prompterData
		// isReady: runningOrderSubscription.ready() && (studioInstallationSubscription ? studioInstallationSubscription.ready() : true)
	}
})(class Prompter extends MeteorReactComponent<Translated<IPrompterProps & IPrompterTrackedProps>, IPrompterState> {

	constructor (props) {
		super(props)
		this.state = {
			subsReady: false,
			// prompterData: null,
			// currentSegmentLineId: null,
			// nextSegmentLineId: null
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
		_.map(prompterData.lines, (line, i: number) => {

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
						key={line.segmentId}
						className={classNames(
							'prompter-segment',
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

				let text: string = segmentLine ? segmentLine.slug : 'N/A'

				text = text.replace(/.*;/, '') // DIREKTE PUNKT FESTIVAL;Split

				divs.push(
					<div
						key={line.segmentLineId}
						className={classNames(
							'prompter-segmentLine',
							'segmentLine-' + line.segmentLineId,
							currentNextLine
						)}
					>
						{ text }
					</div>
				)
			}
			previousSegmentId = line.segmentId
			previousSegmentLineId = line.segmentId

			divs.push(
				<div
					key={i}
					className={classNames(
						'prompter-line'
					)}
				>
					{line.text}
				</div>
			)
		})
		return divs

	}

	render () {
		// const { t } = this.props

		if (this.props.prompterData) {
			return (
				<div className='prompter' >
					{this.renderPrompterData(this.props.prompterData)}
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

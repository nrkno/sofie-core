import * as React from 'react'
import * as $ from 'jquery'
import * as _ from 'underscore'
import * as ClassNames from 'classnames'
import {
	Route
} from 'react-router-dom'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { Rundown, Rundowns } from '../../../lib/collections/Rundowns'
import { Studios, Studio } from '../../../lib/collections/Studios'
import { parse as queryStringParse } from 'query-string'

import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { objectPathGet, firstIfArray } from '../../../lib/lib'
import { Parts } from '../../../lib/collections/Parts'
import { PrompterData, PrompterAPI } from '../../../lib/api/prompter'
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
	rundown?: Rundown
	studio?: Studio
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

	autoScrollPreviousPartId: string | null = null

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
			mirror: firstIfArray(queryParams['mirror']) === '1',
			mirrorv: firstIfArray(queryParams['mirrorv']) === '1',
			restrictMode: firstIfArray(queryParams['mode']) || undefined,
			followTake: (queryParams['followtake'] === undefined ? true : queryParams['followtake'] === '1'),
			fontSize: parseInt(firstIfArray(queryParams['fontsize']) as string, 10) || undefined,
			margin: parseInt(firstIfArray(queryParams['margin']) as string, 10) || undefined,

			marker: firstIfArray(queryParams['marker']) as any || undefined
		}

		this._controller = new PrompterControlManager(this)
	}

	componentWillMount () {
		this.subscribe('rundowns', _.extend({
			active: true
		}, this.props.studioId ? {
			studioId: this.props.studioId
		} : {}))
		if (this.props.studioId) {
			this.subscribe('studios', {
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
		let rundownId = this.props.rundown && this.props.rundown._id
		let rundown = Rundowns.findOne(rundownId || '')
		if (this.configOptions.followTake) {
			if (rundown) {

				if (rundown.currentPartId !== this.autoScrollPreviousPartId) {
					this.autoScrollPreviousPartId = rundown.currentPartId

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
				(startY === -1 || offset.top > startY) &&
				(endY === -1 	|| offset.top <= endY)
			) {
				foundPositions.push(offset.top)
				return true
			}
		})
		foundPositions = _.sortBy(foundPositions, v => sortDirection * v)

		return foundPositions[0] || null
	}
	getScrollPosition (): number | undefined {
		return window.scrollY || window.pageYOffset || (document.documentElement || { scrollTop: undefined }).scrollTop
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

		let rundownId = this.props.rundown && this.props.rundown._id
		let rundown = Rundowns.findOne(rundownId || '')

		if (rundown) {

			const positionTop = this.getScrollPosition() || 0
			const positionBottom = positionTop + window.innerHeight

			const anchors = $('.scroll-anchor')

			let currentPartElement: JQuery<HTMLElement> | null = null
			let currentPartElementAfter: JQuery<HTMLElement> | null = null
			let nextPartElement: JQuery<HTMLElement> | null = null
			let nextPartElementAfter: JQuery<HTMLElement> | null = null

			for (let i = 0; i < anchors.length; i++) {
				const el = anchors[i]
				const next = anchors[i + 1]

				if (rundown.currentPartId && el.className.match('.part-' + rundown.currentPartId)) {
					currentPartElement = $(el)
					currentPartElementAfter = $(next) || null
				}
				if (rundown.nextPartId && el.className.match('.part-' + rundown.nextPartId)) {
					nextPartElement = $(el)
					nextPartElementAfter = $(next) || null
				}
			}

			const currentPositionStart 	= currentPartElement 		? (currentPartElement.offset() 		|| { top: undefined }).top : null
			const currentPositionEnd 	= currentPartElementAfter 	? (currentPartElementAfter.offset() 	|| { top: undefined }).top : null

			// const nextPositionStart 	= nextPartElement 			? (nextPartElement.offset() 		|| {top: undefined}).top : null
			const nextPositionEnd 		= nextPartElementAfter 		? (nextPartElementAfter.offset() 	|| { top: undefined }).top : null

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
			<div className='rundown-view rundown-view--unpublished'>
				<div className='rundown-view__label'>
					<p>
						{message}
					</p>
					<p>
						<Route render={({ history }) => (
							<button className='btn btn-primary' onClick={() => { history.push('/rundowns') }}>
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
					<div className='rundown-view rundown-view--loading' >
						<Spinner />
					</div> :
				(
					this.props.rundown ?
						<Prompter rundownId={this.props.rundown._id} config={this.configOptions} /> :
					this.props.studio ?
						this.renderMessage(t('There is no rundown active in this studio.')) :
					this.props.studioId ?
						this.renderMessage(t('This studio doesn\'t exist.')) :
					this.renderMessage(t('There are no active rundowns.'))
				)
			}
		</React.Fragment>
	}
}
export const PrompterView = translateWithTracker<IProps, {}, ITrackedProps>((props: IProps) => {

	let studioId = objectPathGet(props, 'match.params.studioId')
	let studio
	if (studioId) {
		studio = Studios.findOne(studioId)
	}
	const rundown = Rundowns.findOne(_.extend({
		active: true
	}, {
		studioId: studioId
	}))

	return {
		rundown,
		studio,
		studioId,
		// isReady: rundownSubscription.ready() && (studioSubscription ? studioSubscription.ready() : true)
	}
})(PrompterViewInner)

interface IPrompterProps {
	rundownId: string
	config: PrompterConfig
}
interface IPrompterTrackedProps {
	rundown: Rundown | undefined,
	currentPartId: string,
	nextPartId: string,
	prompterData: PrompterData
}
interface IPrompterState {
	subsReady: boolean
}
export const Prompter = translateWithTracker<IPrompterProps, {}, IPrompterTrackedProps>((props: IPrompterProps) => {

	const rundown = Rundowns.findOne(props.rundownId)

	let prompterData = PrompterAPI.getPrompterData(props.rundownId)

	return {
		rundown: rundown,
		currentPartId: rundown && rundown.currentPartId || '',
		nextPartId: rundown && rundown.nextPartId || '',
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

		this.subscribe('rundowns', 	{ _id: 				this.props.rundownId })
		this.subscribe('segments', 			{ rundownId: 	this.props.rundownId })
		this.subscribe('parts', 		{ rundownId: 	this.props.rundownId })
		this.subscribe('pieces', 	{ rundownId: 	this.props.rundownId })

	}

	renderPrompterData (prompterData: PrompterData) {

		let divs: any[] = []
		let previousSegmentId = ''
		let previousPartId = ''
		_.each(prompterData.lines, (line, i: number) => {

			let currentNextLine: 'current' | 'next' | null = null

			currentNextLine = (
				this.props.currentPartId === line.partId ? 'current' :
				this.props.nextPartId 	=== line.partId ? 'next' :
				null
			)

			if (line.segmentId !== previousSegmentId) {
				let segment = Segments.findOne(line.segmentId)

				divs.push(
					<div
						key={'segment_' + i}
						className={ClassNames(
							'prompter-segment',
							'scroll-anchor',
							'segment-' + line.segmentId,
							'part-' + line.partId,
							currentNextLine
						)}
					>
						{ segment ? segment.name : 'N/A' }
					</div>
				)
			} else if (line.partId !== previousPartId) {

				let part = Parts.findOne(line.partId)
				let title: string = part ? part.title : 'N/A'
				title = title.replace(/.*;/, '') // DIREKTE PUNKT FESTIVAL;Split

				divs.push(
					<div
						key={'part_' + i}
						className={ClassNames(
							'prompter-part',
							'scroll-anchor',
							'part-' + line.partId,
							currentNextLine
						)}
					>
						{title}
					</div>
				)
			}
			previousSegmentId = line.segmentId
			previousPartId = line.partId

			divs.push(
				<div
					key={i}
					className={ClassNames(
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

		if (this.props.prompterData && this.props.rundown) {
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
						<div className={'read-marker ' + (this.props.config.marker || 'hide')}>
							<div className='side left'></div>
							<div className='side right'></div>
						</div>

						<div className='take-indicator hidden'></div>
						<div className='next-indicator hidden'></div>
					</div>

					<div className='prompter-break begin'>
						{this.props.rundown.name}
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

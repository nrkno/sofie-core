import * as React from 'react'
import * as _ from 'underscore'
import * as Velocity from 'velocity-animate'
import * as ClassNames from 'classnames'
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import { Random } from 'meteor/random'
import { Route } from 'react-router-dom'
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
import { PrompterControlManager } from './controller/manager'
import { PubSub } from '../../../lib/api/pubsub'

interface PrompterConfig {
	mirror?: boolean
	mirrorv?: boolean

	mode?: PrompterConfigMode | string
	controlMode?: string
	followTake?: boolean
	fontSize?: number
	margin?: number

	marker?: 'center' | 'top' | 'bottom' | 'hide'
	showMarker: boolean
	showScroll: boolean
}
export enum PrompterConfigMode {
	MOUSE = 'mouse',
	KEYBOARD = 'keyboard',
	SHUTTLEKEYBOARD = 'shuttlekeyboard'
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

	autoScrollPreviousPartId: string | null = null

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
			mirror:				firstIfArray(queryParams['mirror']) === '1',
			mirrorv:			firstIfArray(queryParams['mirrorv']) === '1',
			mode:				firstIfArray(queryParams['mode']) || undefined,
			controlMode:		firstIfArray(queryParams['controlmode']) || undefined,
			followTake:			(queryParams['followtake'] === undefined ? true : queryParams['followtake'] === '1'),
			fontSize:			parseInt(firstIfArray(queryParams['fontsize']) as string, 10) || undefined,
			margin:				parseInt(firstIfArray(queryParams['margin']) as string, 10) || undefined,

			marker:				firstIfArray(queryParams['marker']) as any || undefined,
			showMarker:			(queryParams['showmarker'] === undefined ? true : queryParams['showmarker'] === '1'),
			showScroll:			(queryParams['showscroll'] === undefined ? true : queryParams['showscroll'] === '1')
		}

		this._controller = new PrompterControlManager(this)
	}

	componentWillMount () {
		this.subscribe(PubSub.rundowns, _.extend({
			active: true
		}, this.props.studioId ? {
			studioId: this.props.studioId
		} : {}))
		if (this.props.studioId) {
			this.subscribe(PubSub.studios, {
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

	componentDidMount () {
		document.body.classList.add('dark', 'xdark', 'prompter-scrollbar',
			this.configOptions.showScroll ?
				'vertical-overflow-only' :
				'no-overflow')
		window.addEventListener('scroll', this.onWindowScroll)

		this.triggerCheckCurrentTakeMarkers()
		this.checkScrollToCurrent()
	}

	componentWillUnmount () {
		super.componentWillUnmount()

		document.body.classList.remove('dark', 'xdark', 'prompter-scrollbar',
			this.configOptions.showScroll ?
				'vertical-overflow-only' :
				'no-overflow')
		window.removeEventListener('scroll', this.onWindowScroll)
	}

	componentDidUpdate () {
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

					this.scrollToLive()
				}
			}
		}
	}
	calculateScrollPosition () {
		let pixelMargin = this.calculateMarginPosition()
		switch (this.configOptions.marker) {
			case 'top':
			case 'hide':
				pixelMargin += 0
				break
			case 'center':
				pixelMargin = window.innerHeight / 2
				break
			case 'bottom':
				pixelMargin = window.innerHeight - pixelMargin
				break
		}
		return pixelMargin
	}
	calculateMarginPosition () {
		let pixelMargin = (this.configOptions.margin || 0) * window.innerHeight / 100
		return pixelMargin
	}
	scrollToLive () {
		const scrollMargin = this.calculateScrollPosition()
		const current = document.querySelector('.prompter .live') || document.querySelector('.prompter .next')

		if (current) {
			Velocity(document.body, 'finish')
			Velocity(current, 'scroll', { offset: -1 * scrollMargin, duration: 400, easing: 'ease-out' })
		}
	}
	scrollToNext () {
		const scrollMargin = this.calculateScrollPosition()
		const next = document.querySelector('.prompter .next')

		if (next) {
			Velocity(document.body, 'finish')
			Velocity(next, 'scroll', { offset: -1 * scrollMargin, duration: 400, easing: 'ease-out' })
		}
	}
	scrollToPrevious () {
		const scrollMargin = this.calculateScrollPosition()
		const screenMargin = this.calculateMarginPosition()
		const anchors = this.listAnchorPositions(-1, 10 + scrollMargin)

		const target = anchors[anchors.length - 2] || anchors[0]
		if (!target) return

		Velocity(document.body, 'finish')
		Velocity(document.body, 'scroll', { offset: window.scrollY - scrollMargin + target[0], duration: 200, easing: 'ease-out' })
	}
	scrollToFollowing () {
		const scrollMargin = this.calculateScrollPosition()
		const screenMargin = this.calculateMarginPosition()
		const anchors = this.listAnchorPositions(40 + scrollMargin, -1)

		const target = anchors[0]
		if (!target) return

		Velocity(document.body, 'finish')
		Velocity(document.body, 'scroll', { offset: window.scrollY - scrollMargin + target[0], duration: 200, easing: 'ease-out' })
	}
	listAnchorPositions (startY: number, endY: number, sortDirection: number = 1): [number, Element][] {
		let foundPositions: [number, Element][] = []
		// const anchors = document.querySelectorAll('.prompter .scroll-anchor')

		Array.from(document.querySelectorAll('.prompter .scroll-anchor')).forEach(anchor => {
			const { top } = anchor.getBoundingClientRect()
			if ((startY === -1 || top > startY) &&
				(endY === -1 || top <= endY)) {
				foundPositions.push([top, anchor])
			}
		})

		foundPositions = _.sortBy(foundPositions, v => sortDirection * v[0])

		return foundPositions
	}
	findAnchorPosition (startY: number, endY: number, sortDirection: number = 1): number | null {
		return (this.listAnchorPositions(startY, endY, sortDirection)[0] || [])[0] || null
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
		const rundownId = this.props.rundown && this.props.rundown._id
		const rundown = Rundowns.findOne(rundownId || '')

		if (rundown !== undefined) {

			const positionTop = window.scrollY
			const positionBottom = positionTop + window.innerHeight

			let currentPartElement: Element | null = null
			let currentPartElementAfter: Element | null = null
			let nextPartElementAfter: Element | null = null

			const anchors: Array<Element> = Array.from(document.querySelectorAll('.scroll-anchor'))

			for (let index = 0; index < anchors.length; index++) {
				const current = anchors[index]
				const next = index + 1 < anchors.length ? anchors[index + 1] : null

				if (rundown.currentPartId && current.classList.contains(`part-${rundown.currentPartId}`)) {
					currentPartElement = current
					currentPartElementAfter = next
				}
				if (rundown.nextPartId && current.classList.contains(`part-${rundown.nextPartId}`)) {
					nextPartElementAfter = next
				}
			}

			const currentPositionStart = currentPartElement ? currentPartElement.getBoundingClientRect().top + positionTop : null
			const currentPositionEnd = currentPartElementAfter ? currentPartElementAfter.getBoundingClientRect().top + positionTop : null

			const nextPositionEnd = nextPartElementAfter ? nextPartElementAfter.getBoundingClientRect().top + positionTop : null

			const takeIndicator = document.querySelector('.take-indicator')
			if (takeIndicator) {
				if (currentPositionEnd && currentPositionEnd < positionTop) {
					// Display take "^" indicator
					takeIndicator.classList.remove('hidden')
					takeIndicator.classList.add('top')
				} else if (currentPositionStart && currentPositionStart > positionBottom) {
					// Display take "v" indicator
					takeIndicator.classList.remove('hidden', 'top')
				} else {
					takeIndicator.classList.add('hidden')
				}
			}

			const nextIndicator = document.querySelector('.take-indicator')
			if (nextIndicator) {
				if (nextPositionEnd && nextPositionEnd < positionTop) {
					// Display next "^" indicator
					nextIndicator.classList.remove('hidden')
					nextIndicator.classList.add('top')
				} else {
					nextIndicator.classList.add('hidden')
				}
			}
		}
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
	private _scrollAnchor: [number, string] | undefined

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

		this.subscribe(PubSub.rundowns, { _id: this.props.rundownId })
		this.subscribe(PubSub.segments, { rundownId: this.props.rundownId })
		this.subscribe(PubSub.parts, { rundownId: this.props.rundownId })
		this.subscribe(PubSub.pieces, { rundownId: this.props.rundownId })

	}

	UNSAFE_componentWillUpdate () {
		// TODO: find an element to anchor to
		let readPosition = (this.props.config.margin || 0) * window.innerHeight / 100
		switch (this.props.config.marker) {
			case 'top':
			case 'hide':
				break
			case 'center':
				readPosition = window.innerHeight / 2
				break
			case 'bottom':
				readPosition = window.innerHeight - readPosition
				break
		}

		let foundPositions: [number, string][] = []
		// const anchors = document.querySelectorAll('.prompter .scroll-anchor')

		Array.from(document.querySelectorAll('.prompter .scroll-anchor')).forEach(anchor => {
			const { top } = anchor.getBoundingClientRect()
			if ((top + readPosition) <= 10) foundPositions.push([top, '.' + anchor.className.replace(/\s/g, '.')])
		})

		foundPositions = _.sortBy(foundPositions, v => 1 * v[0])

		if (foundPositions.length > 0) {
			this._scrollAnchor = foundPositions[foundPositions.length - 1]
		}
	}

	componentDidUpdate () {
		// TODO: Restore element's position

		if (this._scrollAnchor) {
			const anchor = document.querySelector(this._scrollAnchor[1])
			if (anchor) {
				const { top } = anchor.getBoundingClientRect()

				window.scrollBy({
					top: top - this._scrollAnchor[0]
				})

				this._scrollAnchor = undefined
			} else {
				console.warn('Read anchor could not be found: ' + this._scrollAnchor[1])
			}
		}
	}

	renderPrompterData (prompterData: PrompterData) {

		let lines: React.ReactNode[] = []
		let previousSegmentId = ''
		let previousPartId = ''
		_.each(prompterData.lines, (line, i: number) => {

			let currentNextLine: 'live' | 'next' | null = null

			currentNextLine = (
				this.props.currentPartId === line.partId ? 'live' :
					this.props.nextPartId === line.partId ? 'next' :
						null
			)

			if (line.segmentId !== previousSegmentId) {
				let segment = Segments.findOne(line.segmentId)

				lines.push(
					<div
						key={'segment_' + line.segmentId + '_' + line.id}
						className={ClassNames(
							'prompter-segment',
							'scroll-anchor',
							'segment-' + line.segmentId,
							'part-' + line.partId,
							currentNextLine
						)}
					>
						{segment ? segment.name : 'N/A'}
					</div>
				)
			} else if (line.partId !== previousPartId) {

				let part = Parts.findOne(line.partId)
				let title: string = part ? part.title : 'N/A'
				if (part && part.typeVariant && part.typeVariant.toString && part.typeVariant.toString().toLowerCase().trim() === 'full') {
					title = 'FULL'
				}
				title = title.replace(/.*;/, '') // DIREKTE PUNKT FESTIVAL;Split

				lines.push(
					<div
						key={'part_' + line.partId + '_' + line.id}
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

			lines.push(
				<div
					key={'line_' + line.partId + '_' + line.segmentId + '_' + line.id}
					className={ClassNames(
						'prompter-line',
						(!line.text ? 'empty' : undefined)
					)}
				>
					{line.text || ''}
				</div>
			)
		})

		return lines
	}
	render () {
		const { t } = this.props

		if (this.props.prompterData && this.props.rundown) {
			return (
				<div
					className={ClassNames('prompter', this.props.config.mirror ? 'mirror' : undefined, this.props.config.mirrorv ? 'mirrorv' : undefined)}
					style={{
						fontSize: (this.props.config.fontSize ? this.props.config.fontSize + 'vh' : undefined),
					}}
				>
					<div className='overlay-fix'>
						<div className={'read-marker ' + (
							!this.props.config.showMarker ? 'hide' : (this.props.config.marker || 'hide')
						)}></div>

						<div className='take-indicator hidden'></div>
						<div className='next-indicator hidden'></div>
					</div>

					<div className='prompter-display'
						style={{
							paddingLeft: (this.props.config.margin ? this.props.config.margin + 'vw' : undefined),
							paddingRight: (this.props.config.margin ? this.props.config.margin + 'vw' : undefined),
							paddingTop: this.props.config.marker === 'center' ?
											'50vh' :
										this.props.config.marker === 'bottom' ?
												'100vh' :
										(this.props.config.margin ? this.props.config.margin + 'vh' : undefined),
							paddingBottom: this.props.config.marker === 'center' ?
													'50vh' :
											this.props.config.marker === 'top' ?
													'100vh' :
											(this.props.config.margin ? this.props.config.margin + 'vh' : undefined),
						}}
					>
						<div className='prompter-break begin'>
							{this.props.rundown.name}
						</div>

						{this.renderPrompterData(this.props.prompterData)}

						{
							this.props.prompterData.lines.length ?
								<div className='prompter-break end'>
									—{t('End of script')}—
							</div> : null
						}
					</div>
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

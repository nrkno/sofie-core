import * as React from 'react'
import * as _ from 'underscore'
import Velocity from 'velocity-animate'
import ClassNames from 'classnames'
import { Meteor } from 'meteor/meteor'
import { Tracker } from 'meteor/tracker'
import { Random } from 'meteor/random'
import { Route } from 'react-router-dom'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { RundownPlaylist, RundownPlaylists, RundownPlaylistId } from '../../../lib/collections/RundownPlaylists'
import { Studios, Studio, StudioId } from '../../../lib/collections/Studios'
import { parse as queryStringParse } from 'query-string'

import { Spinner } from '../../lib/Spinner'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { objectPathGet, firstIfArray, literal, protectString } from '../../../lib/lib'
import { PrompterData, PrompterAPI, PrompterDataPart } from '../../../lib/api/prompter'
import { PrompterControlManager } from './controller/manager'
import { PubSub } from '../../../lib/api/pubsub'
import { PartInstanceId } from '../../../lib/collections/PartInstances'
import { documentTitle } from '../../lib/DocumentTitleProvider'

interface PrompterConfig {
	mirror?: boolean
	mirrorv?: boolean
	mode?: Array<PrompterConfigMode | string | undefined>
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
	SHUTTLEKEYBOARD = 'shuttlekeyboard',
	JOYCON = 'joycon',
}

interface IProps {
	match?: {
		params?: {
			studioId: StudioId
		}
	}
}

interface ITrackedProps {
	rundownPlaylist?: RundownPlaylist
	studio?: Studio
	studioId?: StudioId
	// isReady: boolean
}

interface IState {
	subsReady: boolean
}

export class PrompterViewInner extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	usedHotkeys: Array<string> = []

	autoScrollPreviousPartInstanceId: PartInstanceId | null = null

	configOptions: PrompterConfig

	private _controller: PrompterControlManager

	private checkWindowScroll: number | null = null

	constructor(props) {
		super(props)
		this.state = {
			subsReady: false,
		}
		// Disable the context menu:
		document.addEventListener('contextmenu', (e) => {
			e.preventDefault()
		})

		const queryParams = queryStringParse(location.search)

		this.configOptions = {
			mirror: firstIfArray(queryParams['mirror']) === '1',
			mirrorv: firstIfArray(queryParams['mirrorv']) === '1',
			mode: new Array().concat(queryParams['mode']),
			controlMode: firstIfArray(queryParams['controlmode']) || undefined,
			followTake: queryParams['followtake'] === undefined ? true : queryParams['followtake'] === '1',
			fontSize: parseInt(firstIfArray(queryParams['fontsize']) as string, 10) || undefined,
			margin: parseInt(firstIfArray(queryParams['margin']) as string, 10) || undefined,

			marker: (firstIfArray(queryParams['marker']) as any) || undefined,
			showMarker: queryParams['showmarker'] === undefined ? true : queryParams['showmarker'] === '1',
			showScroll: queryParams['showscroll'] === undefined ? true : queryParams['showscroll'] === '1',
		}

		this._controller = new PrompterControlManager(this)
	}

	componentDidMount() {
		if (this.props.studioId) {
			this.subscribe(PubSub.studios, {
				_id: this.props.studioId,
			})

			this.subscribe(PubSub.rundownPlaylists, {
				active: true,
				studioId: this.props.studioId,
			})
		}

		let playlistId: RundownPlaylistId =
			(this.props.rundownPlaylist && this.props.rundownPlaylist._id) || protectString('')

		this.autorun(() => {
			let playlist = RundownPlaylists.findOne(playlistId)
			if (playlistId) {
				this.subscribe(PubSub.rundowns, {
					playlistId: playlistId,
				})
			}
		})

		this.autorun(() => {
			let subsReady = this.subscriptionsReady()
			if (subsReady !== this.state.subsReady) {
				this.setState({
					subsReady: subsReady,
				})
			}
		})

		document.body.classList.add(
			'dark',
			'xdark',
			'prompter-scrollbar',
			this.configOptions.showScroll ? 'vertical-overflow-only' : 'no-overflow'
		)
		window.addEventListener('scroll', this.onWindowScroll)

		this.triggerCheckCurrentTakeMarkers()
		this.checkScrollToCurrent()

		this.setDocumentTitle()
	}

	componentWillUnmount() {
		super.componentWillUnmount()

		documentTitle.set(null)

		document.body.classList.remove(
			'dark',
			'xdark',
			'prompter-scrollbar',
			this.configOptions.showScroll ? 'vertical-overflow-only' : 'no-overflow'
		)
		window.removeEventListener('scroll', this.onWindowScroll)
	}

	componentDidUpdate() {
		this.triggerCheckCurrentTakeMarkers()
		this.checkScrollToCurrent()
	}

	private setDocumentTitle() {
		const { t } = this.props

		documentTitle.set(t('Prompter'))
	}

	checkScrollToCurrent() {
		let playlistId: RundownPlaylistId =
			(this.props.rundownPlaylist && this.props.rundownPlaylist._id) || protectString('')
		let playlist = RundownPlaylists.findOne(playlistId)

		if (this.configOptions.followTake) {
			if (playlist) {
				if (playlist.currentPartInstanceId !== this.autoScrollPreviousPartInstanceId) {
					this.autoScrollPreviousPartInstanceId = playlist.currentPartInstanceId

					this.scrollToLive()
				}
			}
		}
	}
	calculateScrollPosition() {
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
	calculateMarginPosition() {
		let pixelMargin = ((this.configOptions.margin || 0) * window.innerHeight) / 100
		return pixelMargin
	}
	scrollToLive() {
		const scrollMargin = this.calculateScrollPosition()
		const current = document.querySelector('.prompter .live') || document.querySelector('.prompter .next')

		if (current) {
			Velocity(document.body, 'finish')
			Velocity(current, 'scroll', { offset: -1 * scrollMargin, duration: 400, easing: 'ease-out' })
		}
	}
	scrollToNext() {
		const scrollMargin = this.calculateScrollPosition()
		const next = document.querySelector('.prompter .next')

		if (next) {
			Velocity(document.body, 'finish')
			Velocity(next, 'scroll', { offset: -1 * scrollMargin, duration: 400, easing: 'ease-out' })
		}
	}
	scrollToPrevious() {
		const scrollMargin = this.calculateScrollPosition()
		const screenMargin = this.calculateMarginPosition()
		const anchors = this.listAnchorPositions(-1, 10 + scrollMargin)

		const target = anchors[anchors.length - 2] || anchors[0]
		if (!target) return

		Velocity(document.body, 'finish')
		Velocity(document.body, 'scroll', {
			offset: window.scrollY - scrollMargin + target[0],
			duration: 200,
			easing: 'ease-out',
		})
	}
	scrollToFollowing() {
		const scrollMargin = this.calculateScrollPosition()
		const screenMargin = this.calculateMarginPosition()
		const anchors = this.listAnchorPositions(40 + scrollMargin, -1)

		const target = anchors[0]
		if (!target) return

		Velocity(document.body, 'finish')
		Velocity(document.body, 'scroll', {
			offset: window.scrollY - scrollMargin + target[0],
			duration: 200,
			easing: 'ease-out',
		})
	}
	listAnchorPositions(startY: number, endY: number, sortDirection: number = 1): [number, Element][] {
		let foundPositions: [number, Element][] = []
		// const anchors = document.querySelectorAll('.prompter .scroll-anchor')

		Array.from(document.querySelectorAll('.prompter .scroll-anchor')).forEach((anchor) => {
			const { top } = anchor.getBoundingClientRect()
			if ((startY === -1 || top > startY) && (endY === -1 || top <= endY)) {
				foundPositions.push([top, anchor])
			}
		})

		foundPositions = _.sortBy(foundPositions, (v) => sortDirection * v[0])

		return foundPositions
	}
	findAnchorPosition(startY: number, endY: number, sortDirection: number = 1): number | null {
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
		let playlistId: RundownPlaylistId =
			(this.props.rundownPlaylist && this.props.rundownPlaylist._id) || protectString('')
		const playlist = RundownPlaylists.findOne(playlistId || '')

		if (playlist !== undefined) {
			const positionTop = window.scrollY
			const positionBottom = positionTop + window.innerHeight

			let currentPartElement: Element | null = null
			let currentPartElementAfter: Element | null = null
			let nextPartElementAfter: Element | null = null

			const anchors: Array<Element> = Array.from(document.querySelectorAll('.scroll-anchor'))

			for (let index = 0; index < anchors.length; index++) {
				const current = anchors[index]
				const next = index + 1 < anchors.length ? anchors[index + 1] : null

				if (playlist.currentPartInstanceId && current.classList.contains(`part-${playlist.currentPartInstanceId}`)) {
					currentPartElement = current
					currentPartElementAfter = next
				}
				if (playlist.nextPartInstanceId && current.classList.contains(`part-${playlist.nextPartInstanceId}`)) {
					nextPartElementAfter = next
				}
			}

			const currentPositionStart = currentPartElement
				? currentPartElement.getBoundingClientRect().top + positionTop
				: null
			const currentPositionEnd = currentPartElementAfter
				? currentPartElementAfter.getBoundingClientRect().top + positionTop
				: null

			const nextPositionEnd = nextPartElementAfter
				? nextPartElementAfter.getBoundingClientRect().top + positionTop
				: null

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

	renderMessage(message: string) {
		const { t } = this.props

		return (
			<div className="rundown-view rundown-view--unpublished">
				<div className="rundown-view__label">
					<p>{message}</p>
					<p>
						<Route
							render={({ history }) => (
								<button
									className="btn btn-primary"
									onClick={() => {
										history.push('/rundowns')
									}}>
									{t('Return to list')}
								</button>
							)}
						/>
					</p>
				</div>
			</div>
		)
	}

	render() {
		const { t } = this.props

		return (
			<React.Fragment>
				{!this.state.subsReady ? (
					<div className="rundown-view rundown-view--loading">
						<Spinner />
					</div>
				) : this.props.rundownPlaylist ? (
					<Prompter rundownPlaylistId={this.props.rundownPlaylist._id} config={this.configOptions} />
				) : this.props.studio ? (
					this.renderMessage(t('There is no rundown active in this studio.'))
				) : this.props.studioId ? (
					this.renderMessage(t("This studio doesn't exist."))
				) : (
					this.renderMessage(t('There are no active rundowns.'))
				)}
			</React.Fragment>
		)
	}
}
export const PrompterView = translateWithTracker<IProps, {}, ITrackedProps>((props: IProps) => {
	const studioId = objectPathGet(props, 'match.params.studioId')
	const studio = studioId ? Studios.findOne(studioId) : undefined

	const rundownPlaylist = RundownPlaylists.findOne({
		active: true,
		studioId: studioId,
	})

	return literal<ITrackedProps>({
		rundownPlaylist,
		studio,
		studioId,
		// isReady: rundownSubscription.ready() && (studioSubscription ? studioSubscription.ready() : true)
	})
})(PrompterViewInner)

interface IPrompterProps {
	rundownPlaylistId: RundownPlaylistId
	config: PrompterConfig
}
interface IPrompterTrackedProps {
	prompterData: PrompterData | undefined
}

type ScrollAnchor = [number, string] | null

export const Prompter = translateWithTracker<IPrompterProps, {}, IPrompterTrackedProps>((props: IPrompterProps) => {
	const playlist = RundownPlaylists.findOne(props.rundownPlaylistId)

	if (playlist) {
		const prompterData = PrompterAPI.getPrompterData(props.rundownPlaylistId)
		return {
			prompterData,
		}
	} else {
		return {
			prompterData: undefined,
		}
	}
})(
	class Prompter extends MeteorReactComponent<Translated<IPrompterProps & IPrompterTrackedProps>, {}> {
		private _debounceUpdate: NodeJS.Timer

		constructor(props) {
			super(props)
			this.state = {
				subsReady: false,
			}
		}

		componentDidMount() {
			this.subscribe(PubSub.rundowns, { playlistId: this.props.rundownPlaylistId })

			// TODO-PartInstance the prompter should probably consider instances
			this.autorun(() => {
				const playlist = RundownPlaylists.findOne(this.props.rundownPlaylistId)
				if (playlist) {
					const rundownIDs = playlist.getRundownIDs()
					this.subscribe(PubSub.segments, {
						rundownId: { $in: rundownIDs },
					})
					this.subscribe(PubSub.parts, {
						rundownId: { $in: rundownIDs },
					})
					this.subscribe(PubSub.partInstances, {
						rundownId: { $in: rundownIDs },
						reset: { $ne: true },
					})
					this.subscribe(PubSub.pieces, {
						startRundownId: { $in: rundownIDs },
					})
				}
			})
		}

		getScrollAnchor = () => {
			let readPosition = ((this.props.config.margin || 0) * window.innerHeight) / 100
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

			Array.from(document.querySelectorAll('.prompter .scroll-anchor')).forEach((anchor) => {
				const { top } = anchor.getBoundingClientRect()
				if (top + readPosition <= 10) foundPositions.push([top, '.' + anchor.className.replace(/\s/g, '.')])
			})

			foundPositions = _.sortBy(foundPositions, (v) => 1 * v[0])

			if (foundPositions.length > 0) {
				return foundPositions[foundPositions.length - 1]
			}
			return null
		}

		restoreScrollAnchor = (scrollAnchor: ScrollAnchor) => {
			if (scrollAnchor === null) return
			const anchor = document.querySelector(scrollAnchor[1])
			if (anchor) {
				const { top } = anchor.getBoundingClientRect()

				window.scrollBy({
					top: top - scrollAnchor[0],
				})
			} else {
				console.warn('Read anchor could not be found: ' + scrollAnchor[1])
			}
		}

		shouldComponentUpdate(nextProps, nextState): boolean {
			clearTimeout(this._debounceUpdate)
			this._debounceUpdate = setTimeout(() => this.forceUpdate(), 250)
			return false
		}

		getSnapshotBeforeUpdate() {
			return this.getScrollAnchor() as any
		}

		componentDidUpdate(prevProps, prevState, snapshot) {
			this.restoreScrollAnchor(snapshot)
		}

		renderPrompterData(prompterData: PrompterData) {
			const getPartStatus = (part: PrompterDataPart) => {
				if (prompterData.currentPartId === part.id) {
					return 'live'
				} else if (prompterData.nextPartId === part.id) {
					return 'next'
				} else {
					return null
				}
			}

			let lines: React.ReactNode[] = []

			prompterData.segments.forEach((segment) => {
				if (segment.parts.length === 0) {
					return
				}

				const firstPart = segment.parts[0]
				const firstPartStatus = getPartStatus(firstPart)

				lines.push(
					<div
						key={'segment_' + segment.id}
						className={ClassNames(
							'prompter-segment',
							'scroll-anchor',
							'segment-' + segment.id,
							'part-' + firstPart.id,
							firstPartStatus
						)}>
						{segment.title || 'N/A'}
					</div>
				)

				segment.parts.forEach((part) => {
					lines.push(
						<div
							key={'part_' + part.id}
							className={ClassNames('prompter-part', 'scroll-anchor', 'part-' + part.id, getPartStatus(part))}>
							{part.title || 'N/A'}
						</div>
					)

					part.pieces.forEach((line) => {
						lines.push(
							<div
								key={'line_' + part.id + '_' + segment.id + '_' + line.id}
								className={ClassNames('prompter-line', !line.text ? 'empty' : undefined)}>
								{line.text || ''}
							</div>
						)
					})
				})
			})

			return lines
		}
		render() {
			const { t } = this.props

			if (this.props.prompterData) {
				return (
					<div
						className={ClassNames(
							'prompter',
							this.props.config.mirror ? 'mirror' : undefined,
							this.props.config.mirrorv ? 'mirrorv' : undefined
						)}
						style={{
							fontSize: this.props.config.fontSize ? this.props.config.fontSize + 'vh' : undefined,
						}}>
						<div className="overlay-fix">
							<div
								className={
									'read-marker ' + (!this.props.config.showMarker ? 'hide' : this.props.config.marker || 'hide')
								}></div>

							<div className="take-indicator hidden"></div>
							<div className="next-indicator hidden"></div>
						</div>

						<div
							className="prompter-display"
							style={{
								paddingLeft: this.props.config.margin ? this.props.config.margin + 'vw' : undefined,
								paddingRight: this.props.config.margin ? this.props.config.margin + 'vw' : undefined,
								paddingTop:
									this.props.config.marker === 'center'
										? '50vh'
										: this.props.config.marker === 'bottom'
										? '100vh'
										: this.props.config.margin
										? this.props.config.margin + 'vh'
										: undefined,
								paddingBottom:
									this.props.config.marker === 'center'
										? '50vh'
										: this.props.config.marker === 'top'
										? '100vh'
										: this.props.config.margin
										? this.props.config.margin + 'vh'
										: undefined,
							}}>
							<div className="prompter-break begin">{this.props.prompterData.title}</div>

							{this.renderPrompterData(this.props.prompterData)}

							{this.props.prompterData.segments.length ? (
								<div className="prompter-break end">—{t('End of script')}—</div>
							) : null}
						</div>
					</div>
				)
			} else {
				return (
					<div className="prompter prompter--loading">
						<Spinner />
					</div>
				)
			}
		}
	}
)

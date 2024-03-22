import React, { PropsWithChildren } from 'react'
import _ from 'underscore'
// @ts-expect-error No types available
import Velocity from 'velocity-animate'
import ClassNames from 'classnames'
import { Meteor } from 'meteor/meteor'
import { Route } from 'react-router-dom'
import {
	Translated,
	useTracker,
	useGlobalDelayedTrackerUpdateState,
	useSubscription,
	useSubscriptions,
} from '../../lib/ReactMeteorData/ReactMeteorData'
import { DBRundownPlaylist } from '@sofie-automation/corelib/dist/dataModel/RundownPlaylist'
import { parse as queryStringParse } from 'query-string'

import { Spinner } from '../../lib/Spinner'
import { firstIfArray, protectString } from '../../../lib/lib'
import { PrompterData, PrompterAPI, PrompterDataPart } from './prompter'
import { PrompterControlManager } from './controller/manager'
import { MeteorPubSub } from '../../../lib/api/pubsub'
import { documentTitle } from '../../lib/DocumentTitleProvider'
import { StudioScreenSaver } from '../StudioScreenSaver/StudioScreenSaver'
import { RundownTimingProvider } from '../RundownView/RundownTiming/RundownTimingProvider'
import { OverUnderTimer } from './OverUnderTimer'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PartInstanceId, PieceId, RundownPlaylistId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { UIStudios } from '../Collections'
import { UIStudio } from '../../../lib/api/studios'
import { RundownPlaylists, Rundowns } from '../../collections'
import { RundownPlaylistCollectionUtil } from '../../../lib/collections/rundownPlaylistUtil'
import { logger } from '../../../lib/logging'
import { CorelibPubSub } from '@sofie-automation/corelib/dist/pubsub'
import { withTranslation } from 'react-i18next'

const DEFAULT_UPDATE_THROTTLE = 250 //ms
const PIECE_MISSING_UPDATE_THROTTLE = 2000 //ms

interface PrompterConfig {
	mirror?: boolean
	mirrorv?: boolean
	mode?: Array<PrompterConfigMode | string | undefined>
	controlMode?: string
	followTake?: boolean
	fontSize?: number
	margin?: number
	joycon_invertJoystick: boolean
	joycon_speedMap?: number[]
	joycon_reverseSpeedMap?: number[]
	joycon_rangeRevMin?: number
	joycon_rangeNeutralMin?: number
	joycon_rangeNeutralMax?: number
	joycon_rangeFwdMax?: number
	pedal_speedMap?: number[]
	pedal_reverseSpeedMap?: number[]
	pedal_rangeRevMin?: number
	pedal_rangeNeutralMin?: number
	pedal_rangeNeutralMax?: number
	pedal_rangeFwdMax?: number
	shuttle_speedMap?: number[]
	marker?: 'center' | 'top' | 'bottom' | 'hide'
	showMarker: boolean
	showScroll: boolean
	debug: boolean
	showOverUnder: boolean
	addBlankLine: boolean
}

export enum PrompterConfigMode {
	MOUSE = 'mouse',
	KEYBOARD = 'keyboard',
	SHUTTLEKEYBOARD = 'shuttlekeyboard',
	JOYCON = 'joycon',
	PEDAL = 'pedal',
}

export interface IPrompterControllerState {
	source: PrompterConfigMode
	lastEvent: string
	lastSpeed: number
}

interface IProps {
	studioId: StudioId
}

interface ITrackedProps {
	rundownPlaylist?: DBRundownPlaylist
	studio?: UIStudio
	subsReady: boolean
}

function asArray<T>(value: T | T[] | null): T[] {
	if (Array.isArray(value)) {
		return value
	} else if (value) {
		return [value]
	} else {
		return []
	}
}

export class PrompterViewContent extends React.Component<Translated<IProps & ITrackedProps>> {
	autoScrollPreviousPartInstanceId: PartInstanceId | null = null

	configOptions: PrompterConfig

	// @ts-expect-error The manager inspects this instance
	private _controller: PrompterControlManager

	private checkWindowScroll: number | null = null

	constructor(props: Translated<IProps & ITrackedProps>) {
		super(props)
		this.state = {
			subsReady: false,
		}
		// Disable the context menu:
		document.addEventListener('contextmenu', (e) => {
			e.preventDefault()
		})

		const queryParams = queryStringParse(location.search, {
			arrayFormat: 'comma',
		})

		this.configOptions = {
			mirror: firstIfArray(queryParams['mirror']) === '1',
			mirrorv: firstIfArray(queryParams['mirrorv']) === '1',
			mode: asArray(queryParams['mode']),
			controlMode: firstIfArray(queryParams['controlmode']) || undefined,
			followTake: queryParams['followtake'] === undefined ? true : queryParams['followtake'] === '1',
			fontSize: parseInt(firstIfArray(queryParams['fontsize']) as string, 10) || undefined,
			margin: parseInt(firstIfArray(queryParams['margin']) as string, 10) || undefined,
			joycon_invertJoystick:
				queryParams['joycon_invertJoystick'] === undefined ? true : queryParams['joycon_invertJoystick'] === '1',
			joycon_speedMap:
				queryParams['joycon_speedMap'] === undefined
					? undefined
					: asArray(queryParams['joycon_speedMap']).map((value) => parseInt(value, 10)),
			joycon_reverseSpeedMap:
				queryParams['joycon_reverseSpeedMap'] === undefined
					? undefined
					: asArray(queryParams['joycon_reverseSpeedMap']).map((value) => parseInt(value, 10)),
			joycon_rangeRevMin: parseInt(firstIfArray(queryParams['joycon_rangeRevMin']) as string, 10) || undefined,
			joycon_rangeNeutralMin: parseInt(firstIfArray(queryParams['joycon_rangeNeutralMin']) as string, 10) || undefined,
			joycon_rangeNeutralMax: parseInt(firstIfArray(queryParams['joycon_rangeNeutralMax']) as string, 10) || undefined,
			joycon_rangeFwdMax: parseInt(firstIfArray(queryParams['joycon_rangeFwdMax']) as string, 10) || undefined,
			pedal_speedMap:
				queryParams['pedal_speedMap'] === undefined
					? undefined
					: asArray(queryParams['pedal_speedMap']).map((value) => parseInt(value, 10)),
			pedal_reverseSpeedMap:
				queryParams['pedal_reverseSpeedMap'] === undefined
					? undefined
					: asArray(queryParams['pedal_reverseSpeedMap']).map((value) => parseInt(value, 10)),
			pedal_rangeRevMin: parseInt(firstIfArray(queryParams['pedal_rangeRevMin']) as string, 10) || undefined,
			pedal_rangeNeutralMin: parseInt(firstIfArray(queryParams['pedal_rangeNeutralMin']) as string, 10) || undefined,
			pedal_rangeNeutralMax: parseInt(firstIfArray(queryParams['pedal_rangeNeutralMax']) as string, 10) || undefined,
			pedal_rangeFwdMax: parseInt(firstIfArray(queryParams['pedal_rangeFwdMax']) as string, 10) || undefined,
			marker: (firstIfArray(queryParams['marker']) as any) || undefined,
			showMarker: queryParams['showmarker'] === undefined ? true : queryParams['showmarker'] === '1',
			showScroll: queryParams['showscroll'] === undefined ? true : queryParams['showscroll'] === '1',
			debug: queryParams['debug'] === undefined ? false : queryParams['debug'] === '1',
			showOverUnder: queryParams['showoverunder'] === undefined ? true : queryParams['showoverunder'] === '1',
			addBlankLine: queryParams['addblanklinke'] === undefined ? true : queryParams['adblankline'] === '1',
		}

		this._controller = new PrompterControlManager(this)
	}

	DEBUG_controllerSpeed(speed: number): void {
		const speedEl = document.getElementById('prompter-debug-speed')
		if (speedEl) {
			speedEl.textContent = speed + ''
		}
	}

	DEBUG_controllerState(state: IPrompterControllerState): void {
		const debug = document.getElementById('prompter-debug')
		if (debug) {
			debug.textContent = ''

			const debugInfo = document.createElement('div')

			const source = document.createElement('h2')
			source.textContent = state.source

			const lastEvent = document.createElement('div')
			lastEvent.classList.add('lastEvent')
			lastEvent.textContent = state.lastEvent

			const lastSpeed = document.createElement('div')
			lastSpeed.id = 'prompter-debug-speed'
			lastSpeed.classList.add('lastSpeed')
			lastSpeed.textContent = state.lastSpeed + ''

			debugInfo.appendChild(source)
			debugInfo.appendChild(lastEvent)
			debugInfo.appendChild(lastSpeed)
			debug.appendChild(debugInfo)
		}
	}

	componentDidMount(): void {
		const themeColor = document.head.querySelector('meta[name="theme-color"]')
		if (themeColor) {
			themeColor.setAttribute('data-content', themeColor.getAttribute('content') || '')
			themeColor.setAttribute('content', '#000000')
		}

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

	componentWillUnmount(): void {
		documentTitle.set(null)

		const themeColor = document.head.querySelector('meta[name="theme-color"]')
		if (themeColor) {
			themeColor.setAttribute('content', themeColor.getAttribute('data-content') || '#ffffff')
		}

		document.body.classList.remove(
			'dark',
			'xdark',
			'prompter-scrollbar',
			this.configOptions.showScroll ? 'vertical-overflow-only' : 'no-overflow'
		)
		window.removeEventListener('scroll', this.onWindowScroll)
	}

	componentDidUpdate(): void {
		this.triggerCheckCurrentTakeMarkers()
		this.checkScrollToCurrent()
	}

	private setDocumentTitle() {
		const { t } = this.props

		documentTitle.set(t('Prompter'))
	}

	private checkScrollToCurrent() {
		const playlistId: RundownPlaylistId =
			(this.props.rundownPlaylist && this.props.rundownPlaylist._id) || protectString('')
		const playlist = RundownPlaylists.findOne(playlistId)

		if (!this.configOptions.followTake) return
		if (!playlist) return
		if (playlist.currentPartInfo?.partInstanceId === this.autoScrollPreviousPartInstanceId) return
		this.autoScrollPreviousPartInstanceId = playlist.currentPartInfo?.partInstanceId ?? null
		if (playlist.currentPartInfo === null) return

		this.scrollToPartInstance(playlist.currentPartInfo.partInstanceId)
	}
	private calculateScrollPosition() {
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
	private calculateMarginPosition() {
		// margin in pixels
		return ((this.configOptions.margin || 0) * window.innerHeight) / 100
	}
	scrollToPartInstance(partInstanceId: PartInstanceId): void {
		const scrollMargin = this.calculateScrollPosition()
		const target = document.querySelector(`#partInstance_${partInstanceId}`)

		if (target) {
			Velocity(document.body, 'finish')
			Velocity(target, 'scroll', { offset: -1 * scrollMargin, duration: 400, easing: 'ease-out' })
		}
	}
	scrollToLive(): void {
		const scrollMargin = this.calculateScrollPosition()
		const current = document.querySelector('.prompter .live') || document.querySelector('.prompter .next')

		if (current) {
			Velocity(document.body, 'finish')
			Velocity(current, 'scroll', { offset: -1 * scrollMargin, duration: 400, easing: 'ease-out' })
		}
	}
	scrollToNext(): void {
		const scrollMargin = this.calculateScrollPosition()
		const next = document.querySelector('.prompter .next')

		if (next) {
			Velocity(document.body, 'finish')
			Velocity(next, 'scroll', { offset: -1 * scrollMargin, duration: 400, easing: 'ease-out' })
		}
	}
	scrollToPrevious(): void {
		const scrollMargin = this.calculateScrollPosition()
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
	scrollToFollowing(): void {
		const scrollMargin = this.calculateScrollPosition()
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
	listAnchorPositions(startY: number, endY: number, sortDirection = 1): [number, Element][] {
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
	findAnchorPosition(startY: number, endY: number, sortDirection = 1): number | null {
		return (this.listAnchorPositions(startY, endY, sortDirection)[0] || [])[0] || null
	}
	private onWindowScroll = () => {
		this.triggerCheckCurrentTakeMarkers()
	}
	private triggerCheckCurrentTakeMarkers = () => {
		// Rate limit:
		if (!this.checkWindowScroll) {
			this.checkWindowScroll = Meteor.setTimeout(() => {
				this.checkWindowScroll = null

				this.checkCurrentTakeMarkers()
			}, 500)
		}
	}
	private checkCurrentTakeMarkers = () => {
		const playlist = this.props.rundownPlaylist

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

				if (playlist.currentPartInfo && current.classList.contains(`live`)) {
					currentPartElement = current
					currentPartElementAfter = next
				}
				if (playlist.nextPartInfo && current.classList.contains(`next`)) {
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

			const nextIndicator = document.querySelector('.next-indicator')
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

	private renderMessage(message: string) {
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
									}}
								>
									{t('Return to list')}
								</button>
							)}
						/>
					</p>
				</div>
			</div>
		)
	}

	render(): JSX.Element {
		const { t } = this.props

		const overUnderStyle: React.CSSProperties = {
			marginTop: this.configOptions.margin ? `${this.configOptions.margin}vh` : undefined,
			marginBottom: this.configOptions.margin ? `${this.configOptions.margin}vh` : undefined,
			marginRight: this.configOptions.margin ? `${this.configOptions.margin}vw` : undefined,
			marginLeft: this.configOptions.margin ? `${this.configOptions.margin}vw` : undefined,
			fontSize: (this.configOptions.fontSize ?? 0) > 12 ? `12vmin` : undefined,
		}

		return (
			<React.Fragment>
				{!this.props.subsReady ? (
					<div className="rundown-view rundown-view--loading">
						<Spinner />
					</div>
				) : this.props.rundownPlaylist ? (
					<>
						<RundownTimingProvider playlist={this.props.rundownPlaylist}>
							<Prompter rundownPlaylistId={this.props.rundownPlaylist._id} config={this.configOptions}>
								{this.configOptions.showOverUnder && (
									<OverUnderTimer rundownPlaylist={this.props.rundownPlaylist} style={overUnderStyle} />
								)}
							</Prompter>
						</RundownTimingProvider>
						{this.configOptions.debug ? (
							<div
								id="prompter-debug"
								style={{
									marginTop: this.configOptions.margin ? this.configOptions.margin + 'vh' : undefined,
									marginBottom: this.configOptions.margin ? this.configOptions.margin + 'vh' : undefined,
									marginLeft: this.configOptions.margin ? this.configOptions.margin + 'vw' : undefined,
									marginRight: this.configOptions.margin ? this.configOptions.margin + 'vw' : undefined,
								}}
							></div>
						) : null}
					</>
				) : this.props.studio ? (
					<StudioScreenSaver studioId={this.props.studio._id} />
				) : this.props.studioId ? (
					this.renderMessage(t("This studio doesn't exist."))
				) : (
					this.renderMessage(t('There are no active rundowns.'))
				)}
			</React.Fragment>
		)
	}
}

const PrompterViewContentWithTranslation = withTranslation()(PrompterViewContent)

export function PrompterView(props: Readonly<IProps>): JSX.Element {
	const subsReady: boolean[] = []
	subsReady.push(useSubscription(MeteorPubSub.uiStudio, props.studioId))
	subsReady.push(useSubscription(MeteorPubSub.rundownPlaylistForStudio, props.studioId, true))

	const playlist = useTracker(
		() =>
			RundownPlaylists.findOne(
				{
					studioId: props.studioId,
					activationId: { $exists: true },
				},
				{
					fields: {
						_id: 1,
					},
				}
			) as Pick<DBRundownPlaylist, '_id'> | undefined,
		[props.studioId]
	)
	subsReady.push(useSubscription(CorelibPubSub.rundownsInPlaylists, playlist ? [playlist._id] : []))

	const allSubsReady = subsReady.findIndex((ready) => !ready) === -1

	const studio = useTracker(() => UIStudios.findOne(props.studioId), [props.studioId])

	const rundownPlaylist = useTracker(
		() =>
			RundownPlaylists.findOne(
				{
					activationId: { $exists: true },
					studioId: props.studioId,
				},
				{
					projection: {
						trackedAbSessions: 0,
						lastIncorrectPartPlaybackReported: 0,
					},
				}
			) as Omit<DBRundownPlaylist, 'trackedAbSessions'> | undefined,
		[props.studioId]
	)

	return (
		<PrompterViewContentWithTranslation
			{...props}
			studio={studio}
			rundownPlaylist={rundownPlaylist}
			subsReady={allSubsReady}
		/>
	)
}

interface IPrompterProps {
	rundownPlaylistId: RundownPlaylistId
	config: PrompterConfig
}
interface IPrompterTrackedProps {
	prompterData: PrompterData | null
}

type ScrollAnchor = [number, string] | null

function Prompter(props: Readonly<PropsWithChildren<IPrompterProps>>): JSX.Element {
	useSubscription(CorelibPubSub.rundownsInPlaylists, [props.rundownPlaylistId])

	const playlist = useTracker(
		() =>
			RundownPlaylists.findOne(props.rundownPlaylistId, {
				fields: {
					_id: 1,
					activationId: 1,
				},
			}) as Pick<DBRundownPlaylist, '_id' | 'activationId'> | undefined,
		[props.rundownPlaylistId]
	)
	const rundownIDs = playlist ? RundownPlaylistCollectionUtil.getRundownUnorderedIDs(playlist) : []
	useSubscription(CorelibPubSub.segments, rundownIDs, {})
	useSubscription(CorelibPubSub.parts, rundownIDs, null)
	useSubscription(CorelibPubSub.partInstances, rundownIDs, playlist?.activationId ?? null)
	useSubscription(CorelibPubSub.pieces, rundownIDs, null)
	useSubscription(CorelibPubSub.pieceInstancesSimple, rundownIDs, null)

	const rundowns = useTracker(
		() =>
			Rundowns.find(
				{ playlistId: props.rundownPlaylistId },
				{
					fields: {
						_id: 1,
						showStyleBaseId: 1,
					},
				}
			).fetch() as Pick<Rundown, '_id' | 'showStyleBaseId'>[],
		[props.rundownPlaylistId],
		[]
	)
	useSubscriptions(
		MeteorPubSub.uiShowStyleBase,
		rundowns.map((rundown) => [rundown.showStyleBaseId])
	)

	const nextTrackedProps = useTracker(
		() => PrompterAPI.getPrompterData(props.rundownPlaylistId),
		[props.rundownPlaylistId],
		null
	)

	const delayedTrackedProps = useGlobalDelayedTrackerUpdateState(nextTrackedProps)

	return <PrompterContent {...props} prompterData={delayedTrackedProps} />
}

const PrompterContent = withTranslation()(
	class PrompterContent extends React.Component<
		Translated<PropsWithChildren<IPrompterProps> & IPrompterTrackedProps>,
		{}
	> {
		private _debounceUpdate: NodeJS.Timer | undefined

		constructor(props: Translated<PropsWithChildren<IPrompterProps> & IPrompterTrackedProps>) {
			super(props)
			this.state = {
				subsReady: false,
			}
		}

		getScrollAnchor = () => {
			let readPosition = ((this.props.config.margin || 0) / 100) * window.innerHeight
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

			const windowInnerHeight = window.innerHeight
			const margin = windowInnerHeight / 30

			Array.from(document.querySelectorAll('.prompter .prompter-line:not(.empty)')).forEach((anchor) => {
				const { top, bottom } = anchor.getBoundingClientRect()
				// find a prompter line that is in the read area of the viewport
				if (top <= windowInnerHeight && bottom >= readPosition) foundPositions.push([top, anchor.id])
			})

			// if we didn't find any text, let's use scroll-anchors instead (Segment and Part names)
			if (foundPositions.length === 0) {
				Array.from(document.querySelectorAll('.prompter .scroll-anchor')).forEach((anchor) => {
					const { top } = anchor.getBoundingClientRect()
					// find a prompter scroll anchor that is just above the prompter read position
					if (top <= readPosition + margin) foundPositions.push([top, anchor.id])
				})
			}

			foundPositions = _.sortBy(foundPositions, (topOffset) => Number(topOffset[0]))

			if (foundPositions.length > 0) {
				return foundPositions[foundPositions.length - 1]
			}
			return null
		}

		private restoreScrollAnchor = (scrollAnchor: ScrollAnchor) => {
			if (scrollAnchor === null) return
			const anchor = document.getElementById(scrollAnchor[1])
			if (anchor) {
				const { top } = anchor.getBoundingClientRect()

				window.scrollBy({
					top: top - scrollAnchor[0],
				})
			} else {
				logger.error(`Read anchor could not be found after update: #${scrollAnchor[1]}`)
			}
		}

		shouldComponentUpdate(nextProps: Translated<IPrompterProps & IPrompterTrackedProps>): boolean {
			const { prompterData } = this.props
			const { prompterData: nextPrompterData } = nextProps

			const currentPrompterPieces = _.flatten(
				prompterData?.segments.map((segment) =>
					segment.parts.map((part) =>
						// collect all the PieceId's of all the non-empty pieces of script
						_.compact(part.pieces.map((dataPiece) => (dataPiece.text !== '' ? dataPiece.id : null)))
					)
				) ?? []
			) as PieceId[]
			const nextPrompterPieces = _.flatten(
				nextPrompterData?.segments.map((segment) =>
					segment.parts.map((part) =>
						// collect all the PieceId's of all the non-empty pieces of script
						_.compact(part.pieces.map((dataPiece) => (dataPiece.text !== '' ? dataPiece.id : null)))
					)
				) ?? []
			) as PieceId[]

			// Flag for marking that a Piece is going missing during the update (was present in prompterData
			// no longer present in nextPrompterData)
			let missingPiece = false
			for (const pieceId of currentPrompterPieces) {
				if (!nextPrompterPieces.includes(pieceId)) {
					missingPiece = true
					break
				}
			}

			// Default delay for updating the prompter (for providing stability/batching the updates)
			let delay = DEFAULT_UPDATE_THROTTLE
			// If a Piece has gone missing, delay the update by up to 2 seconds, so that it has a chance to stream in.
			// When the Piece streams in, shouldComponentUpdate will run again, and then, if the piece is available
			// we will use the shorter value and update sooner
			if (missingPiece) delay = PIECE_MISSING_UPDATE_THROTTLE
			clearTimeout(this._debounceUpdate)
			this._debounceUpdate = setTimeout(() => this.forceUpdate(), delay)
			return false
		}

		getSnapshotBeforeUpdate() {
			return this.getScrollAnchor()
		}

		componentDidUpdate(
			_prevProps: Readonly<Translated<PropsWithChildren<IPrompterProps> & IPrompterTrackedProps>>,
			_prevState: Readonly<{}>,
			snapshot: ScrollAnchor
		) {
			this.restoreScrollAnchor(snapshot)
		}

		private getPartStatus(prompterData: PrompterData, part: PrompterDataPart) {
			if (prompterData.currentPartInstanceId === part.id) {
				return 'live'
			} else if (prompterData.nextPartInstanceId === part.id) {
				return 'next'
			} else {
				return null
			}
		}

		private renderPrompterData(prompterData: PrompterData) {
			const lines: React.ReactNode[] = []

			prompterData.segments.forEach((segment) => {
				if (segment.parts.length === 0) {
					return
				}

				const firstPart = segment.parts[0]
				const firstPartStatus = this.getPartStatus(prompterData, firstPart)

				lines.push(
					<div
						id={`segment_${segment.id}`}
						data-obj-id={segment.id}
						key={'segment_' + segment.id}
						className={ClassNames('prompter-segment', 'scroll-anchor', firstPartStatus)}
					>
						{segment.title || 'N/A'}
					</div>
				)

				segment.parts.forEach((part) => {
					lines.push(
						<div
							id={`partInstance_${part.id}`}
							data-obj-id={segment.id + '_' + part.id}
							key={'partInstance_' + part.id}
							className={ClassNames('prompter-part', 'scroll-anchor', this.getPartStatus(prompterData, part))}
						>
							{part.title || 'N/A'}
						</div>
					)

					part.pieces.forEach((line) => {
						lines.push(
							<div
								id={`line_${line.id}`}
								data-obj-id={segment.id + '_' + part.id + '_' + line.id}
								key={'line_' + part.id + '_' + segment.id + '_' + line.id}
								className={ClassNames(
									'prompter-line',
									this.props.config.addBlankLine ? 'add-blank' : undefined,
									!line.text ? 'empty' : undefined
								)}
							>
								{line.text || ''}
							</div>
						)
					})
				})
			})

			return lines
		}
		render(): JSX.Element {
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
						}}
					>
						{this.props.children}

						<div className="overlay-fix">
							<div
								className={
									'read-marker ' + (!this.props.config.showMarker ? 'hide' : this.props.config.marker || 'hide')
								}
							></div>

							<div
								className="indicators"
								style={{
									marginTop: this.props.config.margin ? `${this.props.config.margin}vh` : undefined,
									marginLeft: this.props.config.margin ? `${this.props.config.margin}vw` : undefined,
									marginRight: this.props.config.margin ? `${this.props.config.margin}vw` : undefined,
									fontSize: (this.props.config.fontSize ?? 0) > 12 ? `12vmin` : undefined,
								}}
							>
								<div className="take-indicator hidden"></div>
								<div className="next-indicator hidden"></div>
							</div>
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
							}}
						>
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

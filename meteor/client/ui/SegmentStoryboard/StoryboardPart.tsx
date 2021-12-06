import React, { useCallback, useEffect, useRef, useState } from 'react'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import { PartExtended } from '../../../lib/Rundown'
import { IOutputLayerUi, SegmentUi } from '../SegmentContainer/withResolvedSegment'
import { StoryboardPartSecondaryPieces } from './StoryboardPartSecondaryPieces/StoryboardPartSecondaryPieces'
import { StoryboardPartThumbnail } from './StoryboardPartThumbnail/StoryboardPartThumbnail'
import { ContextMenuTrigger } from '@jstarpl/react-contextmenu'
import { contextMenuHoldToDisplayTime } from '../../lib/lib'
import { getElementDocumentOffset } from '../../utils/positions'
import { IContextMenuContext } from '../RundownView'
import { literal } from '../../../lib/lib'
import { SegmentTimelinePartElementId } from '../SegmentTimeline/Parts/SegmentTimelinePart'
import { CurrentPartRemaining } from '../RundownView/RundownTiming/CurrentPartRemaining'
import { getAllowSpeaking } from '../../lib/localStorage'
import RundownViewEventBus, { HighlightEvent, RundownViewEvents } from '../RundownView/RundownViewEventBus'
import { Meteor } from 'meteor/meteor'
import { StoryboardPartTransitions } from './StoryboardPartTransitions'
import { PartDisplayDuration } from '../RundownView/RundownTiming/PartDuration'

interface IProps {
	className?: string
	segment: SegmentUi
	part: PartExtended
	outputLayers: Record<string, IOutputLayerUi>
	isLivePart: boolean
	isNextPart: boolean
	isLastPartInSegment?: boolean
	inHold: boolean
	currentPartWillAutonext: boolean
	subscriptionsReady: boolean
	displayLiveLineCounter: boolean
	style?: React.CSSProperties
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
	onHoverOver?: () => void
	onHoverOut?: () => void
}

export function StoryboardPart({
	className,
	segment,
	part,
	isLivePart,
	isNextPart,
	isLastPartInSegment,
	currentPartWillAutonext,
	outputLayers,
	subscriptionsReady,
	displayLiveLineCounter,
	style,
	onContextMenu,
	onHoverOver,
	onHoverOut,
}: IProps) {
	const { t } = useTranslation()
	const [highlight, setHighlight] = useState(false)
	const willBeAutoNextedInto = isNextPart ? currentPartWillAutonext : part.willProbablyAutoNext

	const getPartContext = useCallback(() => {
		const partElement = document.querySelector('#' + SegmentTimelinePartElementId + part.instance._id)
		const partDocumentOffset = getElementDocumentOffset(partElement)

		const ctx = literal<IContextMenuContext>({
			segment: segment,
			part: part,
			partDocumentOffset: partDocumentOffset || undefined,
			timeScale: 1,
			mousePosition: { top: 0, left: 0 },
			partStartsAt: 100,
		})

		if (onContextMenu && typeof onContextMenu === 'function') {
			onContextMenu(ctx)
		}

		return ctx
	}, [segment, part])

	const highlightTimeout = useRef<number | null>(null)
	const onHighlight = useCallback(
		(e: HighlightEvent) => {
			if (e.partId == part.partId) {
				// && !e.pieceId
				setHighlight(true)
				if (highlightTimeout.current) Meteor.clearTimeout(highlightTimeout.current)
				highlightTimeout.current = Meteor.setTimeout(() => setHighlight(false), 5000)
			}
		},
		[part.partId]
	)
	useEffect(() => {
		return () => {
			if (highlightTimeout.current) Meteor.clearTimeout(highlightTimeout.current)
		}
	}, [])
	useEffect(() => {
		RundownViewEventBus.on(RundownViewEvents.HIGHLIGHT, onHighlight)

		return () => {
			RundownViewEventBus.off(RundownViewEvents.HIGHLIGHT, onHighlight)
		}
	}, [onHighlight])

	const isInvalid = part.instance.part.invalid
	const isFloated = part.instance.part.floated

	return (
		<ContextMenuTrigger
			id="segment-timeline-context-menu"
			attributes={{
				className: classNames(
					'segment-storyboard__part',
					{
						squished: !!style,
						'invert-flash': highlight,
					},
					className
				),
				//@ts-ignore A Data attribue is perfectly fine
				'data-layer-id': part.instance._id,
				id: SegmentTimelinePartElementId + part.instance._id,
				style: style,
				onMouseEnter: onHoverOver,
				onMouseLeave: onHoverOut,
			}}
			holdToDisplay={contextMenuHoldToDisplayTime()}
			collect={getPartContext}
		>
			<div className="segment-storyboard__identifier">{part.instance.part.identifier}</div>
			{subscriptionsReady ? (
				<>
					<StoryboardPartThumbnail part={part} />
					<StoryboardPartTransitions part={part} outputLayers={outputLayers} />
					<StoryboardPartSecondaryPieces part={part} outputLayers={outputLayers} />
				</>
			) : (
				<>
					<div className="segment-storyboard__part__thumbnail segment-storyboard__part__thumbnail--placeholder"></div>
					<div className="segment-storyboard__part__output-group segment-storyboard__part__output-group--placeholder"></div>
					<div className="segment-storyboard__part__output-group segment-storyboard__part__output-group--placeholder"></div>
				</>
			)}
			{isInvalid ? <div className="segment-storyboard__part__invalid-cover"></div> : null}
			{isFloated ? <div className="segment-storyboard__part__floated-cover"></div> : null}
			<div className="segment-storyboard__part__title">{part.instance.part.title}</div>
			<div
				className={classNames('segment-storyboard__part__next-line', {
					'segment-storyboard__part__next-line--autonext': willBeAutoNextedInto,
					'segment-storyboard__part__next-line--next': isNextPart,
					'segment-storyboard__part__next-line--live': isLivePart,
				})}
			></div>
			<div
				className={classNames('segment-storyboard__part__next-line-label', {
					'segment-storyboard__part__next-line-label--autonext': willBeAutoNextedInto,
					'segment-storyboard__part__next-line-label--next': isNextPart,
					'segment-storyboard__part__next-line-label--live': isLivePart,
				})}
			>
				{isLivePart
					? t('On Air')
					: willBeAutoNextedInto
					? isNextPart
						? t('Auto Next')
						: t('Auto')
					: isNextPart
					? t('Next')
					: isInvalid
					? t('Invalid')
					: null}
			</div>
			{isLastPartInSegment && (
				<div
					className={classNames(
						'segment-storyboard__part__next-line',
						'segment-storyboard__part__next-line--opposite',
						{
							'segment-storyboard__part__next-line--autonext': part.instance.part.autoNext,
						}
					)}
				></div>
			)}
			{isLivePart && displayLiveLineCounter ? (
				<div className="segment-storyboard__part-timer segment-storyboard__part-timer--live">
					<CurrentPartRemaining
						currentPartInstanceId={part.instance._id}
						speaking={getAllowSpeaking()}
						heavyClassName="overtime"
					/>
				</div>
			) : displayLiveLineCounter ? (
				<div className="segment-storyboard__part-timer">
					<PartDisplayDuration fixed={true} part={part} />
				</div>
			) : null}
		</ContextMenuTrigger>
	)
}

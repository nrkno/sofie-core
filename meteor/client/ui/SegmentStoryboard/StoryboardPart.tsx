import React, { useCallback } from 'react'
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

interface IProps {
	segment: SegmentUi
	part: PartExtended
	outputLayers: Record<string, IOutputLayerUi>
	isLivePart: boolean
	isNextPart: boolean
	inHold: boolean
	currentPartWillAutonext: boolean
	subscriptionsReady: boolean
	displayLiveLineCounter: boolean
	onContextMenu?: (contextMenuContext: IContextMenuContext) => void
}

export function StoryboardPart({
	segment,
	part,
	isLivePart,
	isNextPart,
	currentPartWillAutonext,
	outputLayers,
	subscriptionsReady,
	displayLiveLineCounter,
	onContextMenu,
}: IProps) {
	const { t } = useTranslation()
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

	return (
		<ContextMenuTrigger
			id="segment-timeline-context-menu"
			attributes={{
				className: 'segment-storyboard__part',
				//@ts-ignore A Data attribue is perfectly fine
				'data-layer-id': part.instance._id,
				id: SegmentTimelinePartElementId + part.instance._id,
			}}
			holdToDisplay={contextMenuHoldToDisplayTime()}
			collect={getPartContext}
		>
			<div className="segment-storyboard__identifier">{part.instance.part.identifier}</div>
			{subscriptionsReady ? (
				<>
					<StoryboardPartThumbnail part={part} />
					<StoryboardPartSecondaryPieces part={part} outputLayers={outputLayers} />
				</>
			) : (
				<>
					<div className="segment-storyboard__part__thumbnail segment-storyboard__part__thumbnail--placeholder"></div>
					<div className="segment-storyboard__part__output-group segment-storyboard__part__output-group--placeholder"></div>
					<div className="segment-storyboard__part__output-group segment-storyboard__part__output-group--placeholder"></div>
				</>
			)}
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
				{isLivePart ? t('On Air') : willBeAutoNextedInto ? t('Auto') : isNextPart ? t('Next') : null}
			</div>
			{isLivePart && displayLiveLineCounter && (
				<div className="segment-storyboard__liveline">
					<CurrentPartRemaining
						currentPartInstanceId={part.instance._id}
						speaking={getAllowSpeaking()}
						heavyClassName="overtime"
					/>
				</div>
			)}
		</ContextMenuTrigger>
	)
}

import React from 'react'
import classNames from 'classnames'
import { useTranslation } from 'react-i18next'
import { PartExtended } from '../../../lib/Rundown'
import { IOutputLayerUi } from '../SegmentContainer/withResolvedSegment'
import { StoryboardPartSecondaryPieces } from './StoryboardPartSecondaryPieces/StoryboardPartSecondaryPieces'
import { StoryboardPartThumbnail } from './StoryboardPartThumbnail/StoryboardPartThumbnail'

interface IProps {
	part: PartExtended
	outputLayers: Record<string, IOutputLayerUi>
	isLivePart: boolean
	isNextPart: boolean
	inHold: boolean
	currentPartWillAutonext: boolean
	subscriptionsReady: boolean
}

export function StoryboardPart({
	part,
	isLivePart,
	isNextPart,
	currentPartWillAutonext,
	outputLayers,
	subscriptionsReady,
}: IProps) {
	const { t } = useTranslation()
	const willBeAutoNextedInto = isNextPart ? currentPartWillAutonext : part.willProbablyAutoNext
	return (
		<div className="segment-storyboard__part" data-obj-id={part.instance._id}>
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
		</div>
	)
}

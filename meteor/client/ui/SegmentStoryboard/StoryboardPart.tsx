import classNames from 'classnames'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { PartExtended } from '../../../lib/Rundown'
import { StoryboardPartThumbnail } from './StoryboardPartThumbnail/StoryboardPartThumbnail'

interface IProps {
	part: PartExtended
	isLivePart: boolean
	isNextPart: boolean
	inHold: boolean
	currentPartWillAutonext: boolean
}

export function StoryboardPart({ part, isLivePart, isNextPart, currentPartWillAutonext }: IProps) {
	const { t } = useTranslation()
	const willBeAutoNextedInto = isNextPart ? currentPartWillAutonext : part.willProbablyAutoNext
	return (
		<div className="segment-storyboard__part">
			<StoryboardPartThumbnail part={part} />
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

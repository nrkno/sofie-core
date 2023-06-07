import classNames from 'classnames'
import React from 'react'
import { SegmentUi } from '../../SegmentTimeline/SegmentTimelineContainer'
import { RundownUtils } from '../../../lib/rundown'
import { useTranslation } from 'react-i18next'

interface IBreakWallTimeProps {
	segment: SegmentUi
	className?: string
	labelClassName?: string
}

/**
 * A presentational component that will render a counter that will show the wall time that a break starts at.
 * (Or ends at, if there's no start time but an end time is provided.)
 * @function BreakWallTime
 * @extends React.Component<IBreakWallTimeProps>
 */
export const BreakWallTime = function BreakWallTime(props: IBreakWallTimeProps): JSX.Element | null {
	const { t } = useTranslation()
	const value = props.segment.expectedStart ?? props.segment.expectedEnd
	const passedExpectedStart = props.segment.expectedStart && Date.now() > props.segment.expectedStart

	if (value === null || value === undefined) {
		return null
	}

	const date = new Date(value)

	return (
		<>
			<span className={props.labelClassName}>{t(passedExpectedStart ? 'Expected End' : 'Expected Start')}</span>
			<span className={classNames(props.className)} role="timer">
				{RundownUtils.padZeros(date.getHours(), 2)}:{RundownUtils.padZeros(date.getMinutes(), 2)}:
				{RundownUtils.padZeros(date.getSeconds(), 2)}
			</span>
		</>
	)
}

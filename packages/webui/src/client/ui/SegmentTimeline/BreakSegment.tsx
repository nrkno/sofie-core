import React from 'react'
import { WithTranslation, withTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { RundownUtils } from '../../lib/rundown'
import { WithTiming, withTiming } from '../RundownView/RundownTiming/withTiming'

interface IProps {
	breakTime: number | undefined
}

class BreakSegmentInner extends React.Component<Translated<WithTiming<IProps>>> {
	constructor(props: Translated<WithTiming<IProps>>) {
		super(props)
	}

	render(): JSX.Element {
		const { t } = this.props
		const displayTimecode =
			this.props.breakTime && this.props.timingDurations.currentTime
				? this.props.breakTime - this.props.timingDurations.currentTime
				: undefined

		return (
			<div className="segment-timeline has-break">
				<div className="segment-timeline__title">
					<h2 className="segment-timeline__title__label">
						{this.props.breakTime && <Moment interval={0} format="HH:mm:ss" date={this.props.breakTime} />}&nbsp;
						{t('BREAK')}
					</h2>
				</div>
				{displayTimecode && (
					<div className="segment-timeline__timeUntil">
						<span className="segment-timeline__timeUntil__label">{t('Break In')}</span>
						<span>
							{RundownUtils.formatDiffToTimecode(displayTimecode, false, undefined, undefined, undefined, true)}
						</span>
					</div>
				)}
			</div>
		)
	}
}

export const BreakSegment = withTranslation()(withTiming<IProps & WithTranslation, {}>()(BreakSegmentInner))

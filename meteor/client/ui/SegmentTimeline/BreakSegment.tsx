import React from 'react'
import { withTranslation } from 'react-i18next'
import Moment from 'react-moment'
import { getCurrentTime } from '../../../lib/lib'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { RundownUtils } from '../../lib/rundown'
import { RundownTiming } from '../RundownView/RundownTiming/RundownTiming'

interface IProps {
	breakTime: number | undefined
}

interface IState {
	displayTimecode: number | undefined
}

class BreakSegmentInner extends MeteorReactComponent<Translated<IProps>, IState> {
	constructor(props: IProps) {
		super(props)

		this.state = {
			displayTimecode: undefined,
		}

		this.updateTimecode = this.updateTimecode.bind(this)
	}

	componentDidMount() {
		window.addEventListener(RundownTiming.Events.timeupdateLowResolution, this.updateTimecode)
	}

	componentWillUnmount() {
		window.removeEventListener(RundownTiming.Events.timeupdateLowResolution, this.updateTimecode)
	}

	updateTimecode() {
		this.setState({
			displayTimecode: this.props.breakTime ? this.props.breakTime - getCurrentTime() : undefined,
		})
	}

	render() {
		const { t } = this.props

		return (
			<div className="segment-timeline has-break">
				<div className="segment-timeline__title">
					<h2 className="segment-timeline__title__label">
						{this.props.breakTime && <Moment interval={0} format="HH:mm:ss" date={this.props.breakTime} />}&nbsp;
						{t('BREAK')}
					</h2>
				</div>
				{this.state.displayTimecode && (
					<div className="segment-timeline__timeUntil">
						<span className="segment-timeline__timeUntil__label">{t('Break In')}</span>
						<span>
							{RundownUtils.formatDiffToTimecode(
								this.state.displayTimecode,
								false,
								undefined,
								undefined,
								undefined,
								true
							)}
						</span>
					</div>
				)}
			</div>
		)
	}
}

export const BreakSegment = withTranslation()(BreakSegmentInner)

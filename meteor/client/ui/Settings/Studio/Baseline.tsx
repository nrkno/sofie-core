import React from 'react'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Meteor } from 'meteor/meteor'
import Tooltip from 'rc-tooltip'
import { MeteorCall } from '../../../../lib/api/methods'
import { Studio } from '../../../../lib/collections/Studios'
import { getHelpMode } from '../../../lib/localStorage'
import { MeteorReactComponent } from '../../../lib/MeteorReactComponent'
import { Translated } from '../../../lib/ReactMeteorData/ReactMeteorData'

interface IStudioBaselineStatusProps {
	studio: Studio
}
interface IStudioBaselineStatusState {
	needsUpdate: boolean
}

export class StudioBaselineStatus extends MeteorReactComponent<
	Translated<IStudioBaselineStatusProps>,
	IStudioBaselineStatusState
> {
	private updateInterval: number | undefined = undefined

	constructor(props: Translated<IStudioBaselineStatusProps>) {
		super(props)

		this.state = {
			needsUpdate: false,
		}
	}

	componentDidMount(): void {
		const updatePeriod = 30000 // every 30s
		this.updateInterval = Meteor.setInterval(() => this.updateStatus(), updatePeriod)
		this.updateStatus()
	}

	componentWillUnmount(): void {
		if (this.updateInterval) {
			Meteor.clearInterval(this.updateInterval)
			this.updateInterval = undefined
		}
	}

	private updateStatus(props?: Translated<IStudioBaselineStatusProps>) {
		const studio = props ? props.studio : this.props.studio

		MeteorCall.playout
			.shouldUpdateStudioBaseline(studio._id)
			.then((result) => {
				if (this.updateInterval) this.setState({ needsUpdate: !!result })
			})
			.catch((err) => {
				console.error('Failed to update studio baseline status', err)
				if (this.updateInterval) this.setState({ needsUpdate: false })
			})
	}

	private reloadBaseline() {
		MeteorCall.playout
			.updateStudioBaseline(this.props.studio._id)
			.then((result) => {
				if (this.updateInterval) this.setState({ needsUpdate: !!result })
			})
			.catch((err) => {
				console.error('Failed to update studio baseline', err)
				if (this.updateInterval) this.setState({ needsUpdate: false })
			})
	}

	render(): JSX.Element {
		const { t } = this.props
		const { needsUpdate } = this.state

		return (
			<div>
				<p className="mhn">
					{t('Studio Baseline needs update: ')}&nbsp;
					{needsUpdate ? (
						<Tooltip
							overlay={t('Baseline needs reload, this studio may not work until reloaded')}
							visible={getHelpMode()}
							placement="right"
						>
							<span>{t('Yes')}</span>
						</Tooltip>
					) : (
						t('No')
					)}
					{needsUpdate ? (
						<span className="error-notice inline">
							{t('Reload Baseline')} <FontAwesomeIcon icon={faExclamationTriangle} />
						</span>
					) : null}
				</p>
				<p className="mhn">
					<button className="btn btn-primary" onClick={() => this.reloadBaseline()}>
						{t('Reload Baseline')}
					</button>
				</p>
			</div>
		)
	}
}

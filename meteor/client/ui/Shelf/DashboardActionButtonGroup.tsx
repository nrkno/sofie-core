import * as React from 'react'
import * as ClassNames from 'classnames'
import { RundownAPI } from '../../../lib/api/rundown'

import { DEFAULT_BUTTON_HEIGHT, DEFAULT_BUTTON_WIDTH } from './DashboardPieceButton'
import { DashboardLayoutActionButton, ActionButtonType } from '../../../lib/collections/RundownLayouts'
import { DashboardActionButton } from './DashboardActionButton'
import { doUserAction, UserAction } from '../../lib/userAction'
import { translate } from 'react-i18next'
import { Translated } from '../../lib/ReactMeteorData/react-meteor-data'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { MeteorCall } from '../../../lib/api/methods'

export interface IDashboardButtonGroupProps {
	buttons: DashboardLayoutActionButton[]
	studioMode: boolean
	playlist: RundownPlaylist

	onChangeQueueAdLib: (isQueue: boolean, e: any) => void
}

export const DashboardActionButtonGroup = translate()(
	class DashboardActionButtonGroup extends React.Component<Translated<IDashboardButtonGroupProps>> {
		take = (e: any) => {
			const { t } = this.props
			if (this.props.studioMode) {
				doUserAction(t, e, UserAction.TAKE, (e) => MeteorCall.userAction.take(e, this.props.playlist._id))
			}
		}

		onButtonDown = (button: DashboardLayoutActionButton, e: React.SyntheticEvent<HTMLElement>) => {
			switch (button.type) {
				case ActionButtonType.QUEUE_ADLIB:
					this.props.onChangeQueueAdLib && this.props.onChangeQueueAdLib(true, e)
					break
			}
		}

		klarOnAir = (e: any) => {
			const { t } = this.props
			if (this.props.studioMode) {
				if (this.props.playlist.active) {
					doUserAction(t, e, UserAction.DEACTIVATE_RUNDOWN_PLAYLIST, (e) =>
						MeteorCall.userAction.deactivate(e, this.props.playlist._id)
					)
				} else {
					doUserAction(t, e, UserAction.RESET_AND_ACTIVATE_RUNDOWN_PLAYLIST, (e) =>
						MeteorCall.userAction.resetAndActivate(e, this.props.playlist._id)
					)
					doUserAction(t, e, UserAction.TAKE, (e) => MeteorCall.userAction.take(e, this.props.playlist._id))
				}
			}
		}

		onButtonUp = (button: DashboardLayoutActionButton, e: React.SyntheticEvent<HTMLElement>) => {
			switch (button.type) {
				case ActionButtonType.TAKE:
					this.take(e)
					break
				case ActionButtonType.QUEUE_ADLIB:
					this.props.onChangeQueueAdLib && this.props.onChangeQueueAdLib(false, e)
					break
				case ActionButtonType.KLAR_ON_AIR:
					this.klarOnAir(e)
					break
			}
		}

		render() {
			return this.props.buttons.map((button: DashboardLayoutActionButton, index) => (
				<DashboardActionButton
					key={button._id}
					playlist={this.props.playlist}
					onButtonDown={this.onButtonDown}
					onButtonUp={this.onButtonUp}
					button={button}
				/>
			))
		}
	}
)

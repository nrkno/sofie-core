import * as React from 'react'
import ClassNames from 'classnames'
import { RundownAPI } from '../../../lib/api/rundown'

import { DEFAULT_BUTTON_HEIGHT, DEFAULT_BUTTON_WIDTH } from './DashboardPieceButton'
import { DashboardLayoutActionButton, ActionButtonType } from '../../../lib/collections/RundownLayouts'
import { DashboardActionButton } from './DashboardActionButton'
import { doUserAction, UserAction } from '../../lib/userAction'
import { withTranslation } from 'react-i18next'
import { Translated } from '../../lib/ReactMeteorData/react-meteor-data'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { MeteorCall } from '../../../lib/api/methods'
import { RundownHoldState } from '../../../lib/collections/Rundowns'
import { doModalDialog } from '../../lib/ModalDialog'
import { UserActionAPIMethods } from '../../../lib/api/userActions'

export interface IDashboardButtonGroupProps {
	buttons: DashboardLayoutActionButton[]
	studioMode: boolean
	playlist: RundownPlaylist

	onChangeQueueAdLib: (isQueue: boolean, e: any) => void
}

export const DashboardActionButtonGroup = withTranslation()(
	class DashboardActionButtonGroup extends React.Component<Translated<IDashboardButtonGroupProps>> {
		private take = (e: any) => {
			if (this.props.studioMode) {
				const { t } = this.props
				doUserAction(t, e, UserAction.TAKE, (e) => MeteorCall.userAction.take(e, this.props.playlist._id))
			}
		}

		moveNext = (e: any, horizontalDelta: number, verticalDelta: number) => {
			const { t } = this.props
			if (this.props.studioMode) {
				doUserAction(t, e, UserAction.MOVE_NEXT, (e) =>
					MeteorCall.userAction.moveNext(e, this.props.playlist._id, horizontalDelta, verticalDelta)
				)
			}
		}

		hold = (e: any) => {
			const { t } = this.props
			if (this.props.studioMode && this.props.playlist.active) {
				doUserAction(t, e, UserAction.ACTIVATE_HOLD, (e) =>
					MeteorCall.userAction.activateHold(
						e,
						this.props.playlist._id,
						this.props.playlist.holdState === RundownHoldState.PENDING
					)
				)
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
					doModalDialog({
						title: this.props.playlist.name,
						message: t('Are you sure you want to deactivate this Rundown\n(This will clear the outputs)'),
						warning: true,
						onAccept: () => {
							doUserAction(t, e, UserAction.DEACTIVATE_RUNDOWN_PLAYLIST, (e) =>
								MeteorCall.userAction.deactivate(e, this.props.playlist._id)
							)
						},
					})
				} else {
					doUserAction(t, e, UserAction.RESET_AND_ACTIVATE_RUNDOWN_PLAYLIST, (e) =>
						MeteorCall.userAction.resetAndActivate(e, this.props.playlist._id)
					)
					doUserAction(t, e, UserAction.TAKE, (e) => MeteorCall.userAction.take(e, this.props.playlist._id))
				}
			}
		}

		private onButtonUp = (button: DashboardLayoutActionButton, e: React.SyntheticEvent<HTMLElement>) => {
			switch (button.type) {
				case ActionButtonType.TAKE:
					this.take(e)
					break
				case ActionButtonType.QUEUE_ADLIB:
					this.props.onChangeQueueAdLib && this.props.onChangeQueueAdLib(false, e)
					break
				case ActionButtonType.MOVE_NEXT_PART:
					this.moveNext(e, 1, 0)
					break
				case ActionButtonType.MOVE_NEXT_SEGMENT:
					this.moveNext(e, 0, 1)
					break
				case ActionButtonType.MOVE_PREVIOUS_PART:
					this.moveNext(e, -1, 0)
					break
				case ActionButtonType.MOVE_PREVIOUS_SEGMENT:
					this.moveNext(e, 0, -1)
					break
				case ActionButtonType.HOLD:
					this.hold(e)
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

import React from 'react'
import { withTranslation } from 'react-i18next'
import { literal } from '../../../lib/lib'
import { ReactNotification } from '../../lib/notifications/ReactNotification'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { ToolTipStep } from '../RundownList'
import { NotificationAction } from '../../../lib/notifications/notifications'

export interface IRegisterHelpProps {
	step: ToolTipStep
}

export const RegisterHelp = withTranslation()(
	class RegisterHelp extends React.Component<Translated<IRegisterHelpProps>> {
		constructor(props: Translated<IRegisterHelpProps>) {
			super(props)
		}

		render(): JSX.Element {
			const { t, step } = this.props

			return (
				<React.Fragment>
					{step === ToolTipStep.TOOLTIP_START_HERE ? (
						<ReactNotification
							actions={[
								literal<NotificationAction>({
									label: 'Enable',
									action: () => {
										window.location.assign('/?configure=1')
									},
									type: 'button',
								}),
							]}
						>
							{t('Enable configuration mode by adding ?configure=1 to the address bar.')}
						</ReactNotification>
					) : undefined}
					{step === ToolTipStep.TOOLTIP_START_HERE || step === ToolTipStep.TOOLTIP_RUN_MIGRATIONS ? (
						<ReactNotification
							actions={[
								literal<NotificationAction>({
									label: 'Go to migrations',
									action: () => {
										window.location.assign('/settings/tools/migration')
									},
									type: 'button',
								}),
							]}
						>
							{t('You need to run migrations to set the system up for operation.')}
						</ReactNotification>
					) : undefined}
				</React.Fragment>
			)
		}
	}
)

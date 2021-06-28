import React from 'react'
import Tooltip from 'rc-tooltip'
import { getHelpMode } from '../../lib/localStorage'
import { StatusResponse } from '../../../lib/api/systemStatus'
import { withTranslation } from 'react-i18next'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'

const PackageInfo = require('../../../package.json')

interface IRundownListFooterProps {
	systemStatus: StatusResponse
}

export const RundownListFooter = withTranslation()(
	class RundownListFooter extends React.Component<Translated<IRundownListFooterProps>> {
		constructor(props: Translated<IRundownListFooterProps>) {
			super(props)
		}

		render() {
			const { systemStatus, t } = this.props

			return (
				<div className="mtl gutter version-info">
					<p>
						{t('Sofie Automation')} {t('version')}: {PackageInfo.versionExtended || PackageInfo.version || 'UNSTABLE'}
					</p>
					<div className="mod">
						{systemStatus ? (
							<React.Fragment>
								<div>
									{t('System Status')}:&nbsp;
									<Tooltip
										overlay={t('System has issues which need to be resolved')}
										visible={systemStatus.status === 'FAIL' && getHelpMode()}
										placement="top"
									>
										<span>{systemStatus.status}</span>
									</Tooltip>
									&nbsp;/&nbsp;{systemStatus._internal.statusCodeString}
								</div>
								<div>
									{systemStatus._internal.messages.length ? (
										<div>
											{t('Status Messages:')}
											<ul>
												{systemStatus._internal.messages.map((message, i) => {
													return <li key={i}>{message}</li>
												})}
											</ul>
										</div>
									) : null}
								</div>
							</React.Fragment>
						) : null}
					</div>
				</div>
			)
		}
	}
)

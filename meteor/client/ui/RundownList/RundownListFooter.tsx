import React from 'react'
import Tooltip from 'rc-tooltip'
import { getHelpMode } from '../../lib/localStorage'
import { StatusResponse } from '../../../lib/api/systemStatus'
import { TOOLTIP_DEFAULT_DELAY } from '../../lib/lib'
import { useTranslation } from 'react-i18next'

const PackageInfo = require('../../../package.json') as Record<string, any>

interface IProps {
	systemStatus: StatusResponse
}

export function RundownListFooter({ systemStatus }: IProps) {
	const { t } = useTranslation()

	const version = PackageInfo.version || 'UNSTABLE'
	const versionExtended = PackageInfo.versionExtended || version

	return (
		<div className="mtl gutter version-info">
			<p>
				{t('Sofie Automation')} {t('version')}:&nbsp;
				<Tooltip overlay={versionExtended} placement="top" mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}>
					<span>{version}</span>
				</Tooltip>
			</p>
			<div className="mod">
				{systemStatus ? (
					<>
						<div>
							{t('System Status')}:&nbsp;
							<Tooltip
								overlay={t('System has issues which need to be resolved')}
								mouseEnterDelay={TOOLTIP_DEFAULT_DELAY}
								visible={systemStatus.status === 'FAIL' && getHelpMode()}
								placement="top"
							>
								<span>{systemStatus.status}</span>
							</Tooltip>
							&nbsp;/&nbsp;{systemStatus._internal.statusCodeString}
						</div>
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
					</>
				) : null}
			</div>
		</div>
	)
}

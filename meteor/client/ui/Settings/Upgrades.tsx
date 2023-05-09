import React, { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClipboardCheck, faDatabase, faEye } from '@fortawesome/free-solid-svg-icons'
import {
	GetUpgradeStatusResult,
	GetUpgradeStatusResultShowStyleBase,
	GetUpgradeStatusResultStudio,
} from '../../../lib/api/migration'
import { MeteorCall } from '../../../lib/api/methods'
import { useTranslation } from 'react-i18next'
import { Spinner } from '../../lib/Spinner'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import { i18nTranslator } from '../i18n'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { doModalDialog } from '../../lib/ModalDialog'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { BlueprintValidateConfigForStudioResult } from '@sofie-automation/corelib/dist/worker/studio'
import { NotificationCenter, NoticeLevel, Notification } from '../../../lib/notifications/notifications'

export function UpgradesView(): JSX.Element {
	const { t } = useTranslation()

	const [refreshToken, setRefreshToken] = useState(() => getRandomString())
	const [upgradeStatus, setUpgradeStatus] = useState<GetUpgradeStatusResult | null>(null)

	useEffect(() => {
		// clear cached data
		setUpgradeStatus(null)

		MeteorCall.migration
			.getUpgradeStatus()
			.then((res) => {
				setUpgradeStatus(res)
			})
			.catch((e) => {
				console.error('Failed', e)

				NotificationCenter.push(
					new Notification(undefined, NoticeLevel.WARNING, t('Failed to check status.'), 'UpgradesView')
				)
			})
	}, [refreshToken])

	const clickRefresh = useCallback(() => setRefreshToken(getRandomString()), [])

	return (
		<div>
			<h2 className="mhn">{t('Apply blueprint upgrades')}</h2>

			<div className="mod mhn mvm">
				<button className="btn mrm" onClick={clickRefresh}>
					<FontAwesomeIcon icon={faClipboardCheck} />
					<span>{t('Re-check')}</span>
				</button>
			</div>

			<div>
				{!upgradeStatus && <Spinner />}

				<table className="table">
					<thead>
						<th>Name</th>
						<th>&nbsp;</th>
						<th>&nbsp;</th>
					</thead>
					<tbody>
						{upgradeStatus && upgradeStatus.showStyleBases.length === 0 && upgradeStatus.studios.length === 0 && (
							<tr>
								<td colSpan={3}>No Studios or ShowStyles were found</td>
							</tr>
						)}

						{upgradeStatus &&
							upgradeStatus.studios.map((studio) => (
								<ShowUpgradesRow
									key={unprotectString(studio.studioId)}
									resourceName={t('Studio')}
									upgradeResult={studio}
									validateConfig={() => MeteorCall.migration.validateConfigForStudio(studio.studioId)}
									applyConfig={() =>
										MeteorCall.migration.runUpgradeForStudio(studio.studioId).finally(() => {
											clickRefresh()
										})
									}
								/>
							))}

						{upgradeStatus &&
							upgradeStatus.showStyleBases.map((showStyleBase) => (
								<ShowUpgradesRow
									key={unprotectString(showStyleBase.showStyleBaseId)}
									resourceName={t('Show Style')}
									upgradeResult={showStyleBase}
									validateConfig={() =>
										MeteorCall.migration.validateConfigForShowStyleBase(showStyleBase.showStyleBaseId)
									}
									applyConfig={() =>
										MeteorCall.migration.runUpgradeForShowStyleBase(showStyleBase.showStyleBaseId).finally(() => {
											clickRefresh()
										})
									}
								/>
							))}
					</tbody>
				</table>
			</div>
		</div>
	)
}

interface ShowUpgradesRowProps {
	resourceName: string
	upgradeResult: GetUpgradeStatusResultShowStyleBase | GetUpgradeStatusResultStudio
	validateConfig: () => Promise<BlueprintValidateConfigForStudioResult>
	applyConfig: () => Promise<void>
}
function ShowUpgradesRow({ resourceName, upgradeResult, validateConfig, applyConfig }: ShowUpgradesRowProps) {
	const { t } = useTranslation()

	const clickValidate = useCallback(() => {
		validateConfig()
			.then((res) => {
				const nonInfoMessagesCount = res.messages.filter((msg) => msg.level !== NoteSeverity.INFO).length

				doModalDialog({
					title: t('Upgrade config for {{name}}', { name: upgradeResult.name }),
					message: (
						<div>
							{res.messages.length === 0 && <p>{t('Config looks good')}</p>}
							{res.messages.map((msg, i) => (
								<p key={i}>
									{NoteSeverity[msg.level]}: {translateMessage(msg.message, i18nTranslator)}
								</p>
							))}
						</div>
					),
					yes: nonInfoMessagesCount === 0 ? t('Apply') : t('Ignore and apply'),
					no: t('Cancel'),
					onAccept: () => {
						applyConfig()
							.then(() => {
								NotificationCenter.push(
									new Notification(
										undefined,
										NoticeLevel.NOTIFICATION,
										t('Config for {{name}} upgraded successfully', { name: upgradeResult.name }),
										'UpgradesView'
									)
								)
							})
							.catch((e) => {
								NotificationCenter.push(
									new Notification(
										undefined,
										NoticeLevel.WARNING,
										t('Config for {{name}} upgraded failed', { name: upgradeResult.name }),
										'UpgradesView'
									)
								)
								console.error('err', e)
							})
					},
				})
			})
			.catch(() => {
				doModalDialog({
					title: t('Upgrade config for {{name}}', { name: upgradeResult.name }),
					message: t('Failed to validate config'),
					yes: t('Ignore and apply'),
					no: t('Cancel'),
					onAccept: () => {
						applyConfig()
							.then(() => {
								NotificationCenter.push(
									new Notification(
										undefined,
										NoticeLevel.NOTIFICATION,
										t('Config for {{name}} upgraded successfully', { name: upgradeResult.name }),
										'UpgradesView'
									)
								)
							})
							.catch((e) => {
								NotificationCenter.push(
									new Notification(
										undefined,
										NoticeLevel.WARNING,
										t('Config for {{name}} upgraded failed', { name: upgradeResult.name }),
										'UpgradesView'
									)
								)
								console.error('err', e)
							})
					},
				})
			})
	}, [upgradeResult])

	const clickShowChanges = useCallback(() => {
		doModalDialog({
			title: t('Upgrade config for {{name}}', { name: upgradeResult.name }),
			message: (
				<div>
					{upgradeResult.changes.length === 0 && <p>{t('No changes')}</p>}
					{upgradeResult.changes.map((msg, i) => (
						<p key={i}>{translateMessage(msg, i18nTranslator)}</p>
					))}
				</div>
			),
			acceptOnly: true,
			yes: t('Dismiss'),
			onAccept: () => {
				// Do nothing
			},
		})
	}, [upgradeResult])

	return (
		<tr>
			<td>
				{resourceName}:{upgradeResult.name}
			</td>

			<td>
				{upgradeResult.invalidReason && (
					<>
						{t('Unable to upgrade')}: {translateMessage(upgradeResult.invalidReason, i18nTranslator)}
					</>
				)}
				{upgradeResult.changes.length > 0 && t('Upgrade required')}
			</td>

			<td>
				<div className="mod mhn mvm">
					<button
						className="btn mrm"
						onClick={clickShowChanges}
						disabled={!!upgradeResult.invalidReason || upgradeResult.changes.length === 0}
					>
						<FontAwesomeIcon icon={faEye} />
						<span>{t('Show config changes')}</span>
					</button>

					<button className="btn mrm" onClick={clickValidate} disabled={!!upgradeResult.invalidReason}>
						<FontAwesomeIcon icon={faDatabase} />
						<span>{t('Validate Config')}</span>
					</button>
				</div>
			</td>
		</tr>
	)
}

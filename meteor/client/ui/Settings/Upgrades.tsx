import React, { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClipboardCheck, faDatabase } from '@fortawesome/free-solid-svg-icons'
import {
	GetUpgradeStatusResult,
	GetUpgradeStatusResultShowStyleBase,
	GetUpgradeStatusResultStudio,
} from '../../../lib/api/migration'
import { MeteorCall } from '../../../lib/api/methods'
import { useTranslation } from 'react-i18next'
import { Spinner } from '../../lib/Spinner'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import { t } from 'i18next'
import { i18nTranslator } from '../i18n'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { doModalDialog } from '../../lib/ModalDialog'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'

export function UpgradesView() {
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
								<ShowUpgradesForStudio
									key={unprotectString(studio.studioId)}
									studioUpgrade={studio}
									refreshList={clickRefresh}
								/>
							))}

						{upgradeStatus &&
							upgradeStatus.showStyleBases.map((showStyleBase) => (
								<ShowUpgradesForShowStyleBase
									key={unprotectString(showStyleBase.showStyleBaseId)}
									showStyleBaseUpgrade={showStyleBase}
									refreshList={clickRefresh}
								/>
							))}
					</tbody>
				</table>
			</div>
		</div>
	)
}

interface ShowUpgradesForStudioProps {
	refreshList: () => void
	studioUpgrade: GetUpgradeStatusResultStudio
}
function ShowUpgradesForStudio({ studioUpgrade, refreshList }: ShowUpgradesForStudioProps) {
	const clickValidate = useCallback(() => {
		MeteorCall.migration
			.validateConfigForStudio(studioUpgrade.studioId)
			.then((res) => {
				doModalDialog({
					title: t('Upgrade config for {{name}}', { name: studioUpgrade.name }),
					message:
						res.messages.length === 0 ? (
							t('Config looks good')
						) : (
							<div>
								{res.messages.map((msg, i) => (
									<p key={i}>
										{NoteSeverity[msg.level]}: {translateMessage(msg.message, i18nTranslator)}
									</p>
								))}
							</div>
						),
					yes: res.messages.length === 0 ? t('Apply') : t('Ignore and apply'),
					no: t('Cancel'),
					onAccept: () => {
						MeteorCall.migration
							.runUpgradeForStudio(studioUpgrade.studioId)
							.then(() => {
								console.log('done')
								refreshList()
							})
							.catch((e) => {
								console.error('err', e)
								refreshList()
							})
					},
				})
			})
			.catch(() => {
				doModalDialog({
					title: t('Upgrade config for {{name}}', { name: studioUpgrade.name }),
					message: t('Failed to validate config'),
					yes: t('Ignore and apply'),
					no: t('Cancel'),
					onAccept: () => {
						MeteorCall.migration
							.runUpgradeForStudio(studioUpgrade.studioId)
							.then(() => {
								console.log('done')
								refreshList()
							})
							.catch((e) => {
								console.error('err', e)
								refreshList()
							})
					},
				})
			})
	}, [studioUpgrade.studioId, refreshList])

	return (
		<tr>
			<td>
				{t('Studio')}:{studioUpgrade.name}
			</td>

			<td>
				{studioUpgrade.invalidReason && (
					<>
						{t('Unable to upgrade Studio')}: {translateMessage(studioUpgrade.invalidReason, i18nTranslator)}
					</>
				)}
				{studioUpgrade.pendingUpgrade && t('Upgrade required')}
			</td>

			<td>
				<div className="mod mhn mvm">
					<button className="btn mrm" onClick={clickValidate} disabled={!!studioUpgrade.invalidReason}>
						<FontAwesomeIcon icon={faDatabase} />
						<span>{t('Validate Config')}</span>
					</button>
				</div>
			</td>
		</tr>
	)
}

interface ShowUpgradesForShowStyleBaseProps {
	refreshList: () => void
	showStyleBaseUpgrade: GetUpgradeStatusResultShowStyleBase
}
function ShowUpgradesForShowStyleBase({ showStyleBaseUpgrade, refreshList }: ShowUpgradesForShowStyleBaseProps) {
	const clickValidate = useCallback(() => {
		MeteorCall.migration
			.validateConfigForShowStyleBase(showStyleBaseUpgrade.showStyleBaseId)
			.then((res) => {
				doModalDialog({
					title: t('Upgrade config for {{name}}', { name: showStyleBaseUpgrade.name }),
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
					yes: res.messages.length === 0 ? t('Apply') : t('Ignore and apply'),
					no: t('Cancel'),
					onAccept: () => {
						MeteorCall.migration
							.runUpgradeForShowStyleBase(showStyleBaseUpgrade.showStyleBaseId)
							.then(() => {
								console.log('done')
								refreshList()
							})
							.catch((e) => {
								console.error('err', e)
								refreshList()
							})
					},
				})
			})
			.catch(() => {
				doModalDialog({
					title: t('Upgrade config for {{name}}', { name: showStyleBaseUpgrade.name }),
					message: t('Failed to validate config'),
					yes: t('Ignore and apply'),
					no: t('Cancel'),
					onAccept: () => {
						MeteorCall.migration
							.runUpgradeForShowStyleBase(showStyleBaseUpgrade.showStyleBaseId)
							.then(() => {
								console.log('done')
								refreshList()
							})
							.catch((e) => {
								console.error('err', e)
								refreshList()
							})
					},
				})
			})
	}, [showStyleBaseUpgrade.showStyleBaseId, refreshList])

	return (
		<tr>
			<td>
				{t('Show Style')}:{showStyleBaseUpgrade.name}
			</td>

			<td>
				{showStyleBaseUpgrade.invalidReason && (
					<>
						{t('Unable to upgrade ShowStyleBase')}:{' '}
						{translateMessage(showStyleBaseUpgrade.invalidReason, i18nTranslator)}
					</>
				)}
				{showStyleBaseUpgrade.pendingUpgrade && t('Upgrade required')}
			</td>

			<td>
				<div className="mod mhn mvm">
					<button className="btn mrm" onClick={clickValidate} disabled={!!showStyleBaseUpgrade.invalidReason}>
						<FontAwesomeIcon icon={faDatabase} />
						<span>{t('Validate Config')}</span>
					</button>
				</div>
			</td>
		</tr>
	)
}

import React, { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faBoltLightning, faClipboardCheck, faDatabase } from '@fortawesome/free-solid-svg-icons'
import {
	GetUpgradeStatusResult,
	GetUpgradeStatusResultShowStyleBase,
	GetUpgradeStatusResultStudio,
} from '../../../lib/api/migration'
import { MeteorCall } from '../../../lib/api/methods'
import { useTranslation } from 'react-i18next'
import { Spinner } from '../../lib/Spinner'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { t } from 'i18next'
import { i18nTranslator } from '../i18n'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { doModalDialog } from '../../lib/ModalDialog'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'

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

	const clickRunAllPending = useCallback(() => {
		// TODO
	}, [])
	const clickRunAllForced = useCallback(() => {
		// TODO
	}, [])

	const anyPending = !!(
		upgradeStatus &&
		(upgradeStatus.showStyleBases.find((s) => s.pendingUpgrade) || upgradeStatus.studios.find((s) => s.pendingUpgrade))
	)

	return (
		<div>
			<h2 className="mhn">{t('Apply blueprint upgrades')}</h2>

			<div className="mod mhn mvm">
				<button className="btn mrm" onClick={clickRefresh}>
					<FontAwesomeIcon icon={faClipboardCheck} />
					<span>{t('Re-check')}</span>
				</button>
				<button className="btn mrm" onClick={clickRunAllPending} disabled={!anyPending}>
					<FontAwesomeIcon icon={faDatabase} />
					<span>{t('Apply all pending')}</span>
				</button>
				<button className="btn mrm" onClick={clickRunAllForced}>
					<FontAwesomeIcon icon={faDatabase} />
					<span>{t('Force re-run all')}</span>
				</button>
			</div>

			<div>
				{!upgradeStatus && <Spinner />}

				{upgradeStatus && upgradeStatus.showStyleBases.length === 0 && upgradeStatus.studios.length === 0 && (
					<p>No Studios or ShowStyles were found</p>
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
	const clickRunForced = useCallback(() => {
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
	}, [studioUpgrade.studioId, refreshList])

	return (
		<div>
			<h3>
				{studioUpgrade.name}{' '}
				{studioUpgrade.pendingUpgrade && <FontAwesomeIcon icon={faBoltLightning} title={t('Upgrade required')} />}
			</h3>

			{studioUpgrade.invalidReason && (
				<p>
					{t('Unable to upgrade Studio')}: {translateMessage(studioUpgrade.invalidReason, i18nTranslator)}
				</p>
			)}

			<div className="mod mhn mvm">
				<button className="btn mrm" onClick={clickValidate}>
					<FontAwesomeIcon icon={faDatabase} />
					<span>{t('Validate Config')}</span>
				</button>

				<button className="btn mrm" onClick={clickRunForced}>
					<FontAwesomeIcon icon={faDatabase} />
					<span>{t('Force re-run')}</span>
				</button>
			</div>
		</div>
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
	const clickRunForced = useCallback(() => {
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
	}, [showStyleBaseUpgrade.showStyleBaseId, refreshList])

	return (
		<div>
			<h3>
				{showStyleBaseUpgrade.name}{' '}
				{showStyleBaseUpgrade.pendingUpgrade && (
					<FontAwesomeIcon icon={faBoltLightning} title={t('Upgrade required')} />
				)}
			</h3>

			{showStyleBaseUpgrade.invalidReason && (
				<p>
					{t('Unable to upgrade ShowStyleBase')}: {translateMessage(showStyleBaseUpgrade.invalidReason, i18nTranslator)}
				</p>
			)}

			<div className="mod mhn mvm">
				<button className="btn mrm" onClick={clickValidate}>
					<FontAwesomeIcon icon={faDatabase} />
					<span>{t('Validate Config')}</span>
				</button>

				<button className="btn mrm" onClick={clickRunForced}>
					<FontAwesomeIcon icon={faDatabase} />
					<span>{t('Force re-run')}</span>
				</button>
			</div>
		</div>
	)
}

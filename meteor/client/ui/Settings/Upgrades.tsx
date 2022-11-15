import React, { useCallback, useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faClipboardCheck, faDatabase } from '@fortawesome/free-solid-svg-icons'
import {
	GetUpgradeStatusResult,
	GetUpgradeStatusResultShowStyleBase,
	GetUpgradeStatusResultStudio,
} from '../../../lib/api/migration'
import * as _ from 'underscore'
import { MeteorCall } from '../../../lib/api/methods'
import { useTranslation } from 'react-i18next'
import { Spinner } from '../../lib/Spinner'
import { getRandomString } from '@sofie-automation/corelib/dist/lib'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { t } from 'i18next'
import { i18nTranslator } from '../i18n'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'

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
						<ShowUpgradesForStudio key={unprotectString(studio.studioId)} studioUpgrade={studio} />
					))}

				{upgradeStatus &&
					upgradeStatus.showStyleBases.map((showStyleBase) => (
						<ShowUpgradesForShowStyleBase
							key={unprotectString(showStyleBase.showStyleBaseId)}
							showStyleBaseUpgrade={showStyleBase}
						/>
					))}
			</div>
		</div>
	)
}

interface ShowUpgradesForStudioProps {
	studioUpgrade: GetUpgradeStatusResultStudio
}
function ShowUpgradesForStudio({ studioUpgrade }: ShowUpgradesForStudioProps) {
	const clickRunPending = useCallback(() => {
		MeteorCall.migration
			.runUpgradeForStudio(studioUpgrade.studioId)
			.then(() => {
				console.log('done')
			})
			.catch((e) => {
				console.error('err', e)
			})
		// TODO
	}, [studioUpgrade.studioId])
	const clickRunForced = useCallback(() => {
		// TODO
	}, [])

	return (
		<div>
			<h3>{studioUpgrade.name}</h3>

			{studioUpgrade.invalidReason && (
				<p>
					{t('Unable to upgrade Studio')}: {translateMessage(studioUpgrade.invalidReason, i18nTranslator)}
				</p>
			)}

			<div className="mod mhn mvm">
				<button className="btn mrm" onClick={clickRunPending} disabled={!studioUpgrade.pendingUpgrade}>
					<FontAwesomeIcon icon={faDatabase} />
					<span>{t('Apply all pending')}</span>
				</button>
				<button className="btn mrm" onClick={clickRunForced}>
					<FontAwesomeIcon icon={faDatabase} />
					<span>{t('Force re-run all')}</span>
				</button>
			</div>
		</div>
	)
}

interface ShowUpgradesForShowStyleBaseProps {
	showStyleBaseUpgrade: GetUpgradeStatusResultShowStyleBase
}
function ShowUpgradesForShowStyleBase({ showStyleBaseUpgrade }: ShowUpgradesForShowStyleBaseProps) {
	const clickRunPending = useCallback(() => {
		// TODO
	}, [])
	const clickRunForced = useCallback(() => {
		// TODO
	}, [])

	return (
		<div>
			<h3>{showStyleBaseUpgrade.name}</h3>

			{showStyleBaseUpgrade.invalidReason && (
				<p>
					{t('Unable to upgrade ShowStyleBase')}: {translateMessage(showStyleBaseUpgrade.invalidReason, i18nTranslator)}
				</p>
			)}

			<div className="mod mhn mvm">
				<button className="btn mrm" onClick={clickRunPending} disabled={!showStyleBaseUpgrade.pendingUpgrade}>
					<FontAwesomeIcon icon={faDatabase} />
					<span>{t('Apply all pending')}</span>
				</button>
				<button className="btn mrm" onClick={clickRunForced}>
					<FontAwesomeIcon icon={faDatabase} />
					<span>{t('Force re-run all')}</span>
				</button>
			</div>
		</div>
	)
}

import React, { useCallback } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDatabase, faEye } from '@fortawesome/free-solid-svg-icons'
import { MeteorCall } from '../../../../lib/api/methods'
import { TFunction, useTranslation } from 'react-i18next'
import { i18nTranslator } from '../../i18n'
import { translateMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { doModalDialog } from '../../../lib/ModalDialog'
import { NoteSeverity } from '@sofie-automation/blueprints-integration'
import { NotificationCenter, NoticeLevel, Notification } from '../../../../lib/notifications/notifications'
import {
	UIBlueprintUpgradeStatusBase,
	UIBlueprintUpgradeStatusShowStyle,
	UIBlueprintUpgradeStatusStudio,
} from '../../../../lib/api/upgradeStatus'
import { assertNever } from '@sofie-automation/corelib/dist/lib'
import { catchError } from '../../../lib/lib'

export function getUpgradeStatusMessage(t: TFunction, upgradeResult: UIBlueprintUpgradeStatusBase): string | null {
	if (upgradeResult.invalidReason)
		return `${t('Unable to upgrade')}: ${translateMessage(upgradeResult.invalidReason, i18nTranslator)}`

	if (upgradeResult.changes.length > 0) return t('Upgrade required')

	return null
}

interface UpgradeStatusButtonsProps {
	upgradeResult: UIBlueprintUpgradeStatusStudio | UIBlueprintUpgradeStatusShowStyle
}
export function UpgradeStatusButtons({ upgradeResult }: UpgradeStatusButtonsProps): JSX.Element {
	const { t } = useTranslation()

	const validateConfig = useCallback(async () => {
		switch (upgradeResult.documentType) {
			case 'studio':
				return MeteorCall.migration.validateConfigForStudio(upgradeResult.documentId)
			case 'showStyle':
				return MeteorCall.migration.validateConfigForShowStyleBase(upgradeResult.documentId)
			default:
				assertNever(upgradeResult)
				throw new Error(`Unknown UIBlueprintUpgradeStatusBase documentType`)
		}
	}, [upgradeResult.documentId, upgradeResult.documentType])
	const applyConfig = useCallback(async () => {
		switch (upgradeResult.documentType) {
			case 'studio':
				return MeteorCall.migration.runUpgradeForStudio(upgradeResult.documentId)
			case 'showStyle':
				return MeteorCall.migration.runUpgradeForShowStyleBase(upgradeResult.documentId)
			default:
				assertNever(upgradeResult)
				throw new Error(`Unknown UIBlueprintUpgradeStatusBase documentType`)
		}
	}, [upgradeResult.documentId, upgradeResult.documentType])

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
								catchError('Upgrade applyConfig')(e)
								NotificationCenter.push(
									new Notification(
										undefined,
										NoticeLevel.WARNING,
										t('Config for {{name}} upgraded failed', { name: upgradeResult.name }),
										'UpgradesView'
									)
								)
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
								catchError('Upgrade applyConfig')(e)
								NotificationCenter.push(
									new Notification(
										undefined,
										NoticeLevel.WARNING,
										t('Config for {{name}} upgraded failed', { name: upgradeResult.name }),
										'UpgradesView'
									)
								)
							})
					},
				})
			})
	}, [upgradeResult, validateConfig, applyConfig])

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
	)
}

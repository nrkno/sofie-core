import React, { useCallback, useEffect, useState } from 'react'
import { faExclamationTriangle } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Meteor } from 'meteor/meteor'
import Tooltip from 'rc-tooltip'
import { MeteorCall } from '../../../../lib/api/methods'
import { getHelpMode } from '../../../lib/localStorage'
import { useTranslation } from 'react-i18next'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'

interface IStudioBaselineStatusProps {
	studioId: StudioId
}

export function StudioBaselineStatus({ studioId }: IStudioBaselineStatusProps): JSX.Element {
	const { t } = useTranslation()

	const [needsUpdate, setNeedsUpdate] = useState(false)
	useEffect(() => {
		const updateStatus = () => {
			MeteorCall.playout
				.shouldUpdateStudioBaseline(studioId)
				.then((result) => {
					setNeedsUpdate(!!result)
				})
				.catch((err) => {
					console.error('Failed to update studio baseline status', err)
					setNeedsUpdate(false)
				})
		}

		const updatePeriod = 30000 // every 30s
		const interval = Meteor.setInterval(() => updateStatus(), updatePeriod)
		updateStatus()

		return () => {
			Meteor.clearInterval(interval)
		}
	}, [studioId])

	const reloadBaseline = useCallback(() => {
		MeteorCall.playout
			.updateStudioBaseline(studioId)
			.then((result) => {
				setNeedsUpdate(!!result)
			})
			.catch((err) => {
				console.error('Failed to update studio baseline', err)
				setNeedsUpdate(false)
			})
	}, [studioId])

	return (
		<div>
			<p className="mhn">
				{t('Studio Baseline needs update: ')}&nbsp;
				{needsUpdate ? (
					<Tooltip
						overlay={t('Baseline needs reload, this studio may not work until reloaded')}
						visible={getHelpMode()}
						placement="right"
					>
						<span>{t('Yes')}</span>
					</Tooltip>
				) : (
					t('No')
				)}
				{needsUpdate ? (
					<span className="error-notice inline">
						{t('Reload Baseline')} <FontAwesomeIcon icon={faExclamationTriangle} />
					</span>
				) : null}
			</p>
			<p className="mhn">
				<button className="btn btn-primary" onClick={reloadBaseline}>
					{t('Reload Baseline')}
				</button>
			</p>
		</div>
	)
}

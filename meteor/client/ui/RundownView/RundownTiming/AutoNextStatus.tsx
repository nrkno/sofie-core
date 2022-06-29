import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { withTiming, WithTiming } from './withTiming'

export const AutoNextStatus = withTiming<{}, {}>({
	filter: 'currentPartWillAutoNext',
	isHighResolution: true,
})(function AutoNextStatus({ timingDurations }: WithTiming<{}>) {
	const { t } = useTranslation()

	return timingDurations.currentPartWillAutoNext ? (
		<div className="rundown-view__part__icon rundown-view__part__icon--auto-next">{t('Auto')}</div>
	) : null
})

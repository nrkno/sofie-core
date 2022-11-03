import classNames from 'classnames'
import React from 'react'
import { useTranslation } from 'react-i18next'

export const DeviceTrigger = React.memo(function DeviceTrigger({
	deviceId,
	trigger,
	innerRef,
	selected,
	onClick,
}: {
	deviceId: string
	trigger?: string
	innerRef?: React.Ref<HTMLDivElement>
	selected?: boolean
	onClick?: () => void
}) {
	const { t } = useTranslation()

	return (
		<div
			ref={innerRef}
			className={classNames('triggered-action-entry__device clickable', {
				selected: selected,
			})}
			onClick={onClick}
			tabIndex={0}
			role="button"
		>
			{deviceId ? deviceId : <i className="subtle">{t('Empty')}</i>}
			{trigger ? `: ${trigger}` : null}
		</div>
	)
})

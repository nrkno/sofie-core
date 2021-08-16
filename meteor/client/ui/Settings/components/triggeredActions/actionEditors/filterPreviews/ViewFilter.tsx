import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { IGUIContextFilterLink } from '@sofie-automation/blueprints-integration'
import classNames from 'classnames'

interface IProps {
	link: IGUIContextFilterLink
	final?: boolean
}

export const ViewFilter: React.FC<IProps> = function ViewFilter({ final }: IProps) {
	const { t } = useTranslation()

	return (
		<dl
			className={classNames('triggered-action-entry__action__filter', {
				final: final,
			})}
		>
			<dt>{t('View')}</dt>
		</dl>
	)
}

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { IGUIContextFilterLink } from '@sofie-automation/blueprints-integration'

interface IProps {
	link: IGUIContextFilterLink
}

export const ViewFilter: React.FC<IProps> = function ViewFilter(_props: IProps) {
	const { t } = useTranslation()

	return (
		<dl className="triggered-action-entry__action__filter">
			<dt>{t('View')}</dt>
		</dl>
	)
}

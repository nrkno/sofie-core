import * as React from 'react'
import { IAdLibFilterLink } from '@sofie-automation/blueprints-integration'
import { useTranslation } from 'react-i18next'
import { TFunction } from 'i18next'
import { assertNever } from '../../../../../../../lib/lib'
import classNames from 'classnames'

interface IProps {
	link: IAdLibFilterLink
}

function fieldToLabel(t: TFunction, field: IAdLibFilterLink['field']): string {
	switch (field) {
		case 'global':
			return t('Global AdLibs')
		case 'label':
			return t('Label')
		case 'limit':
			return t('Limit')
		case 'outputLayerId':
			return t('Output Layer')
		case 'part':
			return t('Part')
		case 'pick':
			return t('Pick')
		case 'pickEnd':
			return t('Pick last')
		case 'segment':
			return t('Segment')
		case 'sourceLayerId':
			return t('Source Layer')
		case 'sourceLayerType':
			return t('Source Layer Type')
		case 'tag':
			return t('Tag')
		case 'type':
			return t('Type')
		default:
			assertNever(field)
			return field
	}
}

export const AdLibFilter: React.FC<IProps> = function AdLibFilter({ link }: IProps) {
	const { t } = useTranslation()

	return (
		<dl
			className={classNames('triggered-action-entry__action__filter', {
				final: link.field === 'pick' || link.field === 'pickEnd',
			})}
		>
			<dt>{fieldToLabel(t, link.field)}</dt>
			<dd>{String(link.value)}</dd>
		</dl>
	)
}

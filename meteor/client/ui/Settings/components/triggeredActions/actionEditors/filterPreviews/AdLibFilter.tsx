import React from 'react'
import _ from 'underscore'
import { IAdLibFilterLink, SourceLayerType } from '@sofie-automation/blueprints-integration'
import { useTranslation } from 'react-i18next'
import { TFunction } from 'i18next'
import { assertNever } from '../../../../../../../lib/lib'
import { FilterEditor } from './FilterEditor'
import { ShowStyleBase } from '../../../../../../../lib/collections/ShowStyleBases'

interface IProps {
	link: IAdLibFilterLink
	showStyleBase: ShowStyleBase
	readonly?: boolean
	onChange: (newVal: IAdLibFilterLink, oldVal: IAdLibFilterLink) => void
	onFocus?: () => void
}

function fieldToType(field: IAdLibFilterLink['field']) {
	switch (field) {
		case 'global':
			return 'switch'
		case 'label':
		case 'tag':
			return 'text'
		case 'limit':
		case 'pick':
		case 'pickEnd':
			return 'int'
		case 'outputLayerId':
		case 'sourceLayerId':
		case 'sourceLayerType':
			return 'multiselect'
		case 'part':
		case 'segment':
		case 'type':
			return 'dropdown'
		default:
			assertNever(field)
			return field
	}
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

function fieldToOptions(
	t: TFunction,
	showStyleBase: ShowStyleBase,
	field: IAdLibFilterLink['field']
): Record<string, any> {
	switch (field) {
		case 'global':
		case 'label':
		case 'limit':
		case 'pick':
		case 'pickEnd':
		case 'tag':
			return {}
		case 'outputLayerId':
			return _.object(showStyleBase.outputLayers.map((layer) => [layer._id, layer.name]))
		case 'part':
			return {
				[t('OnAir')]: 'current',
				[t('Next')]: 'next',
			}
		case 'segment':
			return {
				[t('OnAir')]: 'current',
				[t('Next')]: 'next',
			}
		case 'sourceLayerId':
			return _.object(showStyleBase.sourceLayers.map((layer) => [layer._id, layer.name]))
		case 'sourceLayerType':
			return _.pick(SourceLayerType, (key) => Number.isInteger(key))
		case 'type':
			return {
				[t('AdLib')]: 'adLib',
				[t('AdLib Action')]: 'adLibAction',
				[t('Clear Source Layer')]: 'clear',
				[t('Sticky Piece')]: 'sticky',
			}
		default:
			assertNever(field)
			return field
	}
}

function fieldValueToValueLabel(t: TFunction, showStyleBase: ShowStyleBase, link: IAdLibFilterLink) {
	switch (link.field) {
		case 'global':
		case 'label':
		case 'limit':
		case 'pick':
		case 'pickEnd':
		case 'tag':
			return String(link.value)
		case 'outputLayerId':
			return link.value
				.map(
					(outputLayerId) =>
						showStyleBase.outputLayers.find((layer) => layer._id === outputLayerId)?.name ?? outputLayerId
				)
				.join(', ')
		case 'part':
			return (
				_.invert({
					[t('OnAir')]: 'current',
					[t('Next')]: 'next',
				})[link.value] ?? String(link.value)
			)
		case 'segment':
			return (
				_.invert({
					[t('OnAir')]: 'current',
					[t('Next')]: 'next',
				})[link.value] ?? String(link.value)
			)
		case 'sourceLayerId':
			return link.value
				.map(
					(sourceLayerId) =>
						showStyleBase.sourceLayers.find((layer) => layer._id === sourceLayerId)?.name ?? sourceLayerId
				)
				.join(', ')
		case 'sourceLayerType':
			return link.value.map((type) => SourceLayerType[type]).join(', ')
		case 'type':
			return (
				_.invert({
					[t('AdLib')]: 'adLib',
					[t('AdLib Action')]: 'adLibAction',
					[t('Clear Source Layer')]: 'clear',
					[t('Sticky Piece')]: 'sticky',
				})[link.value] ?? String(link.value)
			)
		default:
			assertNever(link)
			//@ts-ignore fallback
			return String(link.value)
	}
}

export const AdLibFilter: React.FC<IProps> = function AdLibFilter({
	link,
	readonly,
	showStyleBase,
	onChange,
	onFocus,
}: IProps) {
	const { t } = useTranslation()

	return (
		<FilterEditor
			field={link.field}
			fields={[
				'global',
				'label',
				'limit',
				'pick',
				'pickEnd',
				'tag',
				'outputLayerId',
				'part',
				'segment',
				'sourceLayerId',
				'sourceLayerType',
				'type',
			]}
			fieldLabel={fieldToLabel(t, link.field)}
			valueLabel={fieldValueToValueLabel(t, showStyleBase, link)}
			value={link.value}
			final={link.field === 'pick' || link.field === 'pickEnd'}
			values={fieldToOptions(t, showStyleBase, link.field)}
			type={fieldToType(link.field)}
			readonly={readonly}
			onChange={(newValue) => {
				onChange(
					{
						...link,
						value: newValue,
					},
					link
				)
			}}
			onChangeField={(newValue) => {
				onChange(
					{
						...link,
						field: newValue,
						value: [],
					},
					link
				)
			}}
			onFocus={onFocus}
		/>
	)
}

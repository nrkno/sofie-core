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
	showStyleBase: ShowStyleBase | undefined
	readonly?: boolean
	opened: boolean
	onChange: (newVal: IAdLibFilterLink, oldVal: IAdLibFilterLink) => void
	onFocus?: () => void
	onInsertNext?: () => void
	onRemove?: () => void
	onClose: () => void
}

function typeOptionsWithLabels(t: TFunction) {
	return {
		[t('Ad-Lib')]: 'adLib',
		[t('Ad-Lib Action')]: 'adLibAction',
		[t('Clear Source Layer')]: 'clear',
		[t('Sticky Piece')]: 'sticky',
	}
}

function fieldToType(field: IAdLibFilterLink['field']) {
	switch (field) {
		case 'global':
			return 'toggle'
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
	showStyleBase: ShowStyleBase | undefined,
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
			return showStyleBase ? _.object(showStyleBase.outputLayers.map((layer) => [layer.name, layer._id])) : {}
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
			return showStyleBase ? _.object(showStyleBase.sourceLayers.map((layer) => [layer.name, layer._id])) : {}
		case 'sourceLayerType':
			return _.pick(SourceLayerType, (key) => Number.isInteger(key))
		case 'type':
			return typeOptionsWithLabels(t)
		default:
			assertNever(field)
			return field
	}
}

function fieldValueToValueLabel(t: TFunction, showStyleBase: ShowStyleBase | undefined, link: IAdLibFilterLink) {
	if (link.value === undefined || (Array.isArray(link.value) && link.value.length === 0)) {
		return ''
	}

	switch (link.field) {
		case 'global':
			return link.value === true ? t('Only Global') : t('Not Global')
		case 'label':
		case 'limit':
		case 'tag':
			return String(link.value)
		case 'pick':
		case 'pickEnd':
			return String(Number(link.value ?? 0) + 1)
		case 'outputLayerId':
			return Array.isArray(link.value)
				? showStyleBase
					? link.value
							.map(
								(outputLayerId) =>
									showStyleBase.outputLayers.find((layer) => layer._id === outputLayerId)?.name ?? outputLayerId
							)
							.join(', ')
					: link.value.join(', ')
				: link.value
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
			return Array.isArray(link.value)
				? showStyleBase
					? link.value
							.map(
								(sourceLayerId) =>
									showStyleBase.sourceLayers.find((layer) => layer._id === sourceLayerId)?.name ?? sourceLayerId
							)
							.join(', ')
					: link.value.join(', ')
				: link.value
		case 'sourceLayerType':
			return Array.isArray(link.value) ? link.value.map((type) => SourceLayerType[type]).join(', ') : link.value
		case 'type':
			return _.invert(typeOptionsWithLabels(t))[link.value] ?? String(link.value)
		default:
			assertNever(link)
			//@ts-ignore fallback
			return String(link.value)
	}
}

function fieldValueMutate(link: IAdLibFilterLink, newValue: any) {
	switch (link.field) {
		case 'global':
			return Boolean(newValue)
		case 'label':
		case 'tag':
			return String(newValue).split(',')
		case 'limit':
			return Number(newValue)
		case 'pick':
		case 'pickEnd':
			return Number(newValue - 1)
		case 'outputLayerId':
		case 'sourceLayerId':
			return Array.isArray(newValue) ? newValue.map((layerId) => String(layerId)) : [String(newValue)]
		case 'part':
		case 'segment':
			return String(newValue)
		case 'sourceLayerType':
			return Array.isArray(newValue) ? newValue.map((type) => Number(type)) : [Number(newValue)]
		case 'type':
			return String(newValue)
		default:
			assertNever(link)
			//@ts-ignore fallback
			return String(newValue)
	}
}

function fieldValueToEditorValue(link: IAdLibFilterLink) {
	if (link.value === undefined || (Array.isArray(link.value) && link.value.length === 0)) {
		return undefined
	}

	switch (link.field) {
		case 'pick':
		case 'pickEnd':
			return Number(link.value + 1)
		case 'label':
		case 'tag':
			return link.value.join(',')
		case 'limit':
			return Number(link.value ?? 0)
		case 'global':
			return link.value === true
		case 'outputLayerId':
		case 'sourceLayerId':
		case 'part':
		case 'segment':
		case 'sourceLayerType':
		case 'type':
			return link.value
		default:
			assertNever(link)
			//@ts-ignore fallback
			return String(newValue)
	}
}

function getAvailableFields(t: TFunction, fields: IAdLibFilterLink['field'][]): Record<string, string> {
	const result: Record<string, string> = {}
	fields.forEach((key) => {
		result[fieldToLabel(t, key)] = key
	})

	return result
}

export const AdLibFilter: React.FC<IProps> = function AdLibFilter({
	link,
	readonly,
	showStyleBase,
	opened,
	onClose,
	onChange,
	onFocus,
	onInsertNext,
	onRemove,
}: IProps) {
	const { t } = useTranslation()

	const fields: IAdLibFilterLink['field'][] = [
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
	]

	return (
		<FilterEditor
			field={link.field}
			fields={getAvailableFields(t, fields)}
			fieldLabel={fieldToLabel(t, link.field)}
			valueLabel={fieldValueToValueLabel(t, showStyleBase, link)}
			value={fieldValueToEditorValue(link)}
			final={link.field === 'pick' || link.field === 'pickEnd'}
			values={fieldToOptions(t, showStyleBase, link.field)}
			type={fieldToType(link.field)}
			readonly={readonly}
			opened={opened}
			onChange={(newValue) => {
				onChange(
					{
						...link,
						value: fieldValueMutate(link, newValue) as any,
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
			onClose={onClose}
			onInsertNext={onInsertNext}
			onRemove={onRemove}
		/>
	)
}

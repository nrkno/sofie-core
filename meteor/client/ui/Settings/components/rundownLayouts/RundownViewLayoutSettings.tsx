import React from 'react'
import { useTranslation } from 'react-i18next'
import { RundownLayoutsAPI } from '../../../../../lib/api/rundownLayouts'
import { RundownLayoutBase, RundownLayouts } from '../../../../../lib/collections/RundownLayouts'
import { DBShowStyleBase } from '../../../../../lib/collections/ShowStyleBases'
import { unprotectString } from '../../../../../lib/lib'
import { EditAttribute } from '../../../../lib/EditAttribute'

function filterLayouts(
	rundownLayouts: RundownLayoutBase[],
	testFunc: (l: RundownLayoutBase) => boolean
): Array<{ name: string; value: string }> {
	return rundownLayouts.filter(testFunc).map((l) => ({ name: l.name, value: unprotectString(l._id) }))
}

interface IProps {
	showStyleBase: DBShowStyleBase
	item: RundownLayoutBase
	layouts: RundownLayoutBase[]
}

function undefinedOnEmptyArray(v: string[]): string[] | undefined {
	if (Array.isArray(v)) {
		if (v.length === 0) {
			return undefined
		} else {
			return v
		}
	}
	return undefined
}

export default function RundownViewLayoutSettings({ showStyleBase, item, layouts }: IProps) {
	const { t } = useTranslation()

	return (
		<>
			<div className="mod mvs mhs">
				<label className="field">
					{t('Expose as user selectable layout')}
					<EditAttribute
						modifiedClassName="bghl"
						attribute={'exposeAsSelectableLayout'}
						obj={item}
						type="checkbox"
						collection={RundownLayouts}
						className="mod mas"
					></EditAttribute>
				</label>
			</div>
			<div className="mod mvs mhs">
				<label className="field">
					{t('Shelf Layout')}
					<EditAttribute
						modifiedClassName="bghl"
						attribute={'shelfLayout'}
						obj={item}
						options={filterLayouts(layouts, RundownLayoutsAPI.isLayoutForShelf)}
						type="dropdown"
						collection={RundownLayouts}
						className="input text-input input-l dropdown"
					></EditAttribute>
				</label>
			</div>
			<div className="mod mvs mhs">
				<label className="field">
					{t('Mini Shelf Layout')}
					<EditAttribute
						modifiedClassName="bghl"
						attribute={'miniShelfLayout'}
						obj={item}
						options={filterLayouts(layouts, RundownLayoutsAPI.isLayoutForMiniShelf)}
						type="dropdown"
						collection={RundownLayouts}
						className="input text-input input-l dropdown"
					></EditAttribute>
				</label>
			</div>
			<div className="mod mvs mhs">
				<label className="field">
					{t('Rundown Header Layout')}
					<EditAttribute
						modifiedClassName="bghl"
						attribute={'rundownHeaderLayout'}
						obj={item}
						options={filterLayouts(layouts, RundownLayoutsAPI.isLayoutForRundownHeader)}
						type="dropdown"
						collection={RundownLayouts}
						className="input text-input input-l dropdown"
					></EditAttribute>
				</label>
			</div>
			<div className="mod mvs mhs">
				<div className="field">
					{t('Select visible Source Layers')}
					<EditAttribute
						modifiedClassName="bghl"
						attribute={'visibleSourceLayers'}
						obj={item}
						options={showStyleBase.sourceLayers
							.sort((a, b) => a._rank - b._rank)
							.map((sourceLayer) => ({
								value: sourceLayer._id,
								name: sourceLayer.name,
							}))}
						type="multiselect"
						mutateUpdateValue={undefinedOnEmptyArray}
						collection={RundownLayouts}
						className="input text-input input-l dropdown"
					></EditAttribute>
				</div>
			</div>
			<div className="mod mvs mhs">
				<div className="field">
					{t('Select visible Output Groups')}
					<EditAttribute
						modifiedClassName="bghl"
						attribute={'visibleOutputLayers'}
						obj={item}
						options={showStyleBase.outputLayers
							.sort((a, b) => a._rank - b._rank)
							.map((outputLayer) => ({
								value: outputLayer._id,
								name: outputLayer.name,
							}))}
						type="multiselect"
						mutateUpdateValue={undefinedOnEmptyArray}
						collection={RundownLayouts}
						className="input text-input input-l dropdown"
					></EditAttribute>
				</div>
			</div>
		</>
	)
}

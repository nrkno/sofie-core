import * as React from 'react'
import ClassNames from 'classnames'
import { RundownAPI } from '../../../../lib/api/rundown'
import { RundownUtils } from '../../../lib/rundown'
import { mousetrapHelper } from '../../../lib/mousetrapHelper'
import { ILayerItemRendererProps } from './ItemRendererFactory'
import { VTContent, LiveSpeakContent } from '@sofie-automation/blueprints-integration'
import { formatDurationAsTimecode } from '../../../../lib/lib'

const _isMacLike = !!navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i)

export const VTSTKListItemRenderer: React.FunctionComponent<ILayerItemRendererProps> = (
	props: ILayerItemRendererProps
) => {
	const vtContent = props.adLibListItem.content as VTContent | LiveSpeakContent | undefined
	let sourceDuration: number | null = null

	if (vtContent) {
		sourceDuration = vtContent.sourceDuration || null
	}

	return (
		<React.Fragment>
			<td
				className={ClassNames(
					'adlib-panel__list-view__list__table__cell--icon',
					props.layer && RundownUtils.getSourceLayerClassName(props.layer.type),
					{
						'source-missing': props.status === RundownAPI.PieceStatusCode.SOURCE_MISSING,
						'source-broken': props.status === RundownAPI.PieceStatusCode.SOURCE_BROKEN,
						'unknown-state': props.status === RundownAPI.PieceStatusCode.UNKNOWN,
					}
				)}>
				{(props.layer && (props.layer.abbreviation || props.layer.name)) || null}
			</td>
			<td className="adlib-panel__list-view__list__table__cell--shortcut">
				{(props.adLibListItem.hotkey && mousetrapHelper.shortcutLabel(props.adLibListItem.hotkey, _isMacLike)) || null}
			</td>
			<td className="adlib-panel__list-view__list__table__cell--output">
				{(props.outputLayer && props.outputLayer.name) || null}
			</td>
			<td className="adlib-panel__list-view__list__table__cell--name">{props.adLibListItem.name}</td>
			<td className="adlib-panel__list-view__list__table__cell--duration">
				{sourceDuration ? formatDurationAsTimecode(sourceDuration) : null}
			</td>
			{/*<td className='adlib-panel__list-view__list__table__cell--data'>
			&nbsp;
		</td>
		<td className='adlib-panel__list-view__list__table__cell--resolution'>
			&nbsp;
		</td>
		<td className='adlib-panel__list-view__list__table__cell--fps'>
			&nbsp;
		</td>
		<td className='adlib-panel__list-view__list__table__cell--tc-start'>
			&nbsp;
		</td> */}
		</React.Fragment>
	)
}

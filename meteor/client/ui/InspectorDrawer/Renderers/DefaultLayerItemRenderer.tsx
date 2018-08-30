import * as React from 'react'

import { SegmentLineAdLibItem } from '../../../../lib/collections/SegmentLineAdLibItems'
import { ISourceLayer, IOutputLayer } from '../../../../lib/collections/StudioInstallations'
import { IAdLibListItem } from '../AdLibListItem'

interface IPropsHeader {
	item: IAdLibListItem
	selected: boolean
	layer: ISourceLayer
	outputLayer?: IOutputLayer
}

export const DefaultListItemRenderer: React.SFC<IPropsHeader> = (props: IPropsHeader) => (
	<React.Fragment>
		<td className='adlib-panel__list-view__list__table__cell--name'>
			{props.item.name}
		</td>
		<td className='adlib-panel__list-view__list__table__cell--data'>
			&nbsp;
		</td>
		<td className='adlib-panel__list-view__list__table__cell--resolution'>
			&nbsp;
		</td>
		<td className='adlib-panel__list-view__list__table__cell--fps'>
			&nbsp;
		</td>
		<td className='adlib-panel__list-view__list__table__cell--duration'>
			&nbsp;
		</td>
		<td className='adlib-panel__list-view__list__table__cell--tc-start'>
			&nbsp;
		</td>
	</React.Fragment>
)

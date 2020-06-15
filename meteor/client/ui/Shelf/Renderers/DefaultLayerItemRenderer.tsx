import * as React from 'react'
import { IAdLibListItem } from '../AdLibListItem'
import { IOutputLayer, ISourceLayer } from 'tv-automation-sofie-blueprints-integration'

interface IPropsHeader {
	adLibListItem: IAdLibListItem
	selected: boolean
	layer: ISourceLayer | undefined
	outputLayer: IOutputLayer | undefined
}

export const DefaultListItemRenderer: React.SFC<IPropsHeader> = (props: IPropsHeader) => (
	<React.Fragment>
		<td className="adlib-panel__list-view__list__table__cell--name">{props.adLibListItem.name}</td>
		{/*<td className='adlib-panel__list-view__list__table__cell--data'>
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
		</td> */}
	</React.Fragment>
)

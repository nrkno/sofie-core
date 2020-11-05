import * as React from 'react'
import { IAdLibListItem } from '../AdLibListItem'
import { IOutputLayer, ISourceLayer } from 'tv-automation-sofie-blueprints-integration'

interface IPropsHeader {
	piece: IAdLibListItem
	selected: boolean
}

export const DefaultListItemRenderer: React.FunctionComponent<IPropsHeader> = (props: IPropsHeader) => (
	<React.Fragment>
		<td className="adlib-panel__list-view__list__table__cell--name">{props.piece.name}</td>
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

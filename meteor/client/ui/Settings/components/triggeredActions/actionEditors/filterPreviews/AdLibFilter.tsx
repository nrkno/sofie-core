import * as React from 'react'
import {
	IRundownPlaylistFilterLink,
	IGUIContextFilterLink,
	IAdLibFilterLink,
} from '@sofie-automation/blueprints-integration'

interface IProps {
	link: IRundownPlaylistFilterLink | IGUIContextFilterLink | IAdLibFilterLink
}

export const AdLibFilter: React.FC<IProps> = function AdLibFilter({ link }: IProps) {
	switch (link.object) {
		case 'adLib':
			return (
				<>
					<dt>{link.field}</dt>
					<dd>{link.value}</dd>
				</>
			)
	}

	return null
}

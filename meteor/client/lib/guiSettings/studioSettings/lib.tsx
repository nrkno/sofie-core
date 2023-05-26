import { literal } from '@sofie-automation/corelib/dist/lib'
import { Studio } from '../../../../lib/collections/Studios'
import { Studios } from '../../../collections'
import { IEditAttribute } from '../../EditAttribute'
import { defaultEditAttributeProps } from '../lib'

export function getDefaultEditAttributeProps(studio: Studio): Partial<IEditAttribute> {
	return literal<Partial<IEditAttribute>>({
		...defaultEditAttributeProps,
		obj: studio,
		collection: Studios,
	})
}

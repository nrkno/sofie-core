import { IRemoveOrphanedPartInstanceContext } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { Rundown } from '../../../../lib/collections/Rundowns'
import { ShowStyleCompound } from '../../../../lib/collections/ShowStyleVariants'
import { Studio } from '../../../../lib/collections/Studios'
import { ContextInfo, RundownUserContext } from './context'

export class RemoveOrphanedPartInstanceContext
	extends RundownUserContext
	implements IRemoveOrphanedPartInstanceContext
{
	constructor(
		contextInfo: ContextInfo,
		studio: ReadonlyDeep<Studio>,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		rundown: ReadonlyDeep<Rundown>
	) {
		super(contextInfo, studio, showStyleCompound, rundown)
	}
}

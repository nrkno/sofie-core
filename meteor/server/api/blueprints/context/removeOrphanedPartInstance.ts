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
	/**
	 * Set to true if blueprints have requested that the instance be removed
	 */
	private removeInstance: boolean

	constructor(
		contextInfo: ContextInfo,
		studio: ReadonlyDeep<Studio>,
		showStyleCompound: ReadonlyDeep<ShowStyleCompound>,
		rundown: ReadonlyDeep<Rundown>
	) {
		super(contextInfo, studio, showStyleCompound, rundown)
	}

	removePartInstance() {
		this.removeInstance = true
	}

	public instanceIsRemoved(): boolean {
		return this.removeInstance
	}
}

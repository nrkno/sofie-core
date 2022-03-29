import { registerCollection, ProtectedStringProperties, ProtectedString, ArrayElement } from '../lib'
import { IBlueprintActionManifest } from '@sofie-automation/blueprints-integration'
import { createMongoCollection } from './lib'
import { PartId } from './Parts'
import { RundownId } from './Rundowns'
import { registerIndex } from '../database'
import { ITranslatableMessage } from '../api/TranslatableMessage'

/** A string, identifying an AdLibActionId */
export type AdLibActionId = ProtectedString<'AdLibActionId'>

/** The following extended interface allows assigning namespace information to the actions as they are stored in the
 *  database after being emitted from the blueprints
 */
export interface AdLibActionCommon extends ProtectedStringProperties<IBlueprintActionManifest, 'partId'> {
	rundownId: RundownId
	display: IBlueprintActionManifest['display'] & {
		label: ITranslatableMessage
		triggerLabel?: ITranslatableMessage
		description?: ITranslatableMessage
	}
	triggerModes?: (ArrayElement<IBlueprintActionManifest['triggerModes']> & {
		display: ArrayElement<IBlueprintActionManifest['triggerModes']>['display'] & {
			label: ITranslatableMessage
			description?: ITranslatableMessage
		}
	})[]

	/**
	 * String that can be used to identify adlibs that are equivalent to each other,
	 * if there are multiple Adlibs with the same uniquenessId,
	 * only one of them should be displayed in the GUI.
	 */
	uniquenessId?: string
}

export interface AdLibAction extends AdLibActionCommon {
	_id: AdLibActionId
	partId: PartId
}

export const AdLibActions = createMongoCollection<AdLibAction, AdLibAction>('adLibActions')
registerCollection('AdLibActions', AdLibActions)
registerIndex(AdLibActions, {
	rundownId: 1,
	partId: 1,
})

import { IStudioContext, BlueprintMappings } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { DBStudio, MappingsExt } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ProcessedStudioConfig } from '../config'
import { getStudioConfigRef } from '../configRefs'
import { applyAndValidateOverrides } from '@sofie-automation/corelib/dist/settings/objectWithOverrides'
import { CommonContext, ContextInfo } from './CommonContext'

/** Studio */

export class StudioContext extends CommonContext implements IStudioContext {
	#processedMappings: ReadonlyDeep<MappingsExt> | undefined

	constructor(
		contextInfo: ContextInfo,
		public readonly studio: ReadonlyDeep<DBStudio>,
		public readonly studioBlueprintConfig: ProcessedStudioConfig
	) {
		super(contextInfo)
	}

	public get studioId(): string {
		return unprotectString(this.studio._id)
	}

	public get studioIdProtected(): StudioId {
		return this.studio._id
	}

	getStudioConfig(): unknown {
		return this.studioBlueprintConfig
	}
	getStudioConfigRef(configKey: string): string {
		return getStudioConfigRef(this.studio._id, configKey)
	}
	getStudioMappings(): Readonly<BlueprintMappings> {
		if (!this.#processedMappings) {
			this.#processedMappings = applyAndValidateOverrides(this.studio.mappingsWithOverrides).obj
		}
		// @ts-expect-error ProtectedString deviceId not compatible with string
		return this.#processedMappings
	}
}

import { IShowStyleContext } from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep } from 'type-fest'
import { DBStudio } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { getShowStyleConfigRef, ProcessedStudioConfig, ProcessedShowStyleConfig } from '../config'
import { ProcessedShowStyleCompound } from '../../jobs'
import { ContextInfo } from './CommonContext'
import { StudioContext } from './StudioContext'

/** Show Style Variant */

export class ShowStyleContext extends StudioContext implements IShowStyleContext {
	constructor(
		contextInfo: ContextInfo,
		studio: ReadonlyDeep<DBStudio>,
		studioBlueprintConfig: ProcessedStudioConfig,
		public readonly showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		public readonly showStyleBlueprintConfig: ProcessedShowStyleConfig
	) {
		super(contextInfo, studio, studioBlueprintConfig)
	}

	getShowStyleConfig(): unknown {
		return this.showStyleBlueprintConfig
	}
	getShowStyleConfigRef(configKey: string): string {
		return getShowStyleConfigRef(this.showStyleCompound.showStyleVariantId, configKey)
	}
}

import { IBlueprintPlayoutDevice, IRundownActivationContext, TSR } from '@sofie-automation/blueprints-integration'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { ReadonlyDeep } from 'type-fest'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs'
import { executePeripheralDeviceAction, listPlayoutDevices } from '../../peripheralDevice'
import { CacheForPlayout } from '../../playout/cache'
import { RundownEventContext } from './RundownEventContext'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'

export class RundownActivationContext extends RundownEventContext implements IRundownActivationContext {
	private readonly _cache: CacheForPlayout
	private readonly _context: JobContext

	constructor(
		context: JobContext,
		cache: CacheForPlayout,
		showStyleCompound: ReadonlyDeep<ProcessedShowStyleCompound>,
		rundown: ReadonlyDeep<DBRundown>
	) {
		super(
			context.studio,
			context.getStudioBlueprintConfig(),
			showStyleCompound,
			context.getShowStyleBlueprintConfig(showStyleCompound),
			rundown
		)

		this._context = context
		this._cache = cache
	}

	async listPlayoutDevices(): Promise<IBlueprintPlayoutDevice[]> {
		return listPlayoutDevices(this._context, this._cache)
	}

	async executeTSRAction(
		deviceId: PeripheralDeviceId,
		actionId: string,
		payload: Record<string, any>
	): Promise<TSR.ActionExecutionResult> {
		return executePeripheralDeviceAction(this._context, deviceId, null, actionId, payload)
	}
}

import { IRundownActivationContext, TSR } from '@sofie-automation/blueprints-integration'
import { PeripheralDeviceId } from '@sofie-automation/shared-lib/dist/core/model/Ids'
import { PeripheralDevicePublicWithActions } from '@sofie-automation/shared-lib/dist/core/model/peripheralDevice'
import { literal } from '@sofie-automation/shared-lib/dist/lib/lib'
import { Complete } from '@sofie-automation/corelib/dist/lib'
import { PeripheralDeviceType } from '@sofie-automation/shared-lib/dist/peripheralDevice/peripheralDeviceAPI'
import { ReadonlyDeep } from 'type-fest'
import { JobContext, ProcessedShowStyleCompound } from '../../jobs'
import { executePeripheralDeviceAction } from '../../peripheralDevice'
import { CacheForPlayout } from '../../playout/cache'
import { RundownEventContext } from './RundownEventContext'
import { DBRundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PeripheralDevice } from '@sofie-automation/corelib/dist/dataModel/PeripheralDevice'

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

	async listPeripheralDevices(): Promise<PeripheralDevicePublicWithActions[]> {
		const parentDeviceIds = this._cache.PeripheralDevices.findAll(
			(doc: PeripheralDevice) =>
				doc.studioId === this._context.studioId && doc.type === PeripheralDeviceType.PLAYOUT
		).map((doc) => doc._id)
		if (parentDeviceIds.length === 0) {
			throw new Error('No parent devices are configured')
		}

		const devices = await this._context.directCollections.PeripheralDevices.findFetch({
			parentDeviceId: {
				$in: parentDeviceIds,
			},
		})

		return devices.map((d) => {
			// Only expose a subset of the PeripheralDevice to the blueprints
			return literal<Complete<PeripheralDevicePublicWithActions>>({
				_id: d._id,
				name: d.name,
				deviceName: d.deviceName,
				studioId: d.studioId,
				category: d.category,
				type: d.type,
				subType: d.subType,
				parentDeviceId: d.parentDeviceId,
				created: d.created,
				status: d.status,
				settings: d.settings,
				actions: d.configManifest.subdeviceManifest?.[d.subType]?.actions,
			})
		})
	}

	async executeTSRAction(
		deviceId: PeripheralDeviceId,
		actionId: string,
		payload: Record<string, any>
	): Promise<TSR.ActionExecutionResult> {
		return executePeripheralDeviceAction(this._context, deviceId, null, actionId, payload)
	}
}

import { WorkerId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Workers, getWorkerId, WorkerStatus } from '../../lib/collections/Workers'
import { getCurrentTime } from '../../lib/lib'

export function initializeWorkerStatus(name: string, instanceId: string): WorkerId {
	const workerId = getWorkerId()

	const now = getCurrentTime()

	const initWorkerProperties = {
		name: name,
		connected: false,
		instanceId: instanceId,
		startTime: now,
		lastUpdatedTime: now,
		status: 'Starting...',
	}

	const existing = Workers.findOne(workerId)
	if (existing) {
		Workers.update(workerId, {
			$set: initWorkerProperties,
		})
		localWorkerCache.set(workerId, {
			...existing,
			...initWorkerProperties,
		})
	} else {
		const newWorkerStatus = {
			...initWorkerProperties,
			_id: workerId,
			createdTime: now,
			lastUsedTime: now,
		}
		Workers.insert(newWorkerStatus)
		localWorkerCache.set(workerId, newWorkerStatus)
	}

	return workerId
}
export function setWorkerStatus(workerId: WorkerId, connected: boolean, status: string, startup?: boolean): void {
	const now = getCurrentTime()

	const mod: Partial<WorkerStatus> = {
		lastUpdatedTime: now,
		connected,
		status,
	}
	if (startup) {
		mod.startTime = now
	}
	const result = Workers.update(workerId, {
		$set: mod,
	})

	if (result > 0) {
		updateLocalCache(workerId, mod)
	}
}

const localWorkerCache = new Map<WorkerId, WorkerStatus>()
/** Returns the workerStatus, possibly from a local cache */
function getWorkerStatus(workerId: WorkerId): WorkerStatus | undefined {
	// Use local cache:
	const cached = localWorkerCache.get(workerId)
	if (cached) return cached

	// Fetch from database:
	const workerStatus = Workers.findOne(workerId)

	// Update local cache:
	if (workerStatus) {
		localWorkerCache.set(workerId, workerStatus)
	} else {
		localWorkerCache.delete(workerId)
	}
	return workerStatus
}
function updateLocalCache(workerId: WorkerId, mod: Partial<WorkerStatus>) {
	const cache = getWorkerStatus(workerId)
	if (cache) {
		localWorkerCache.set(workerId, {
			...cache,
			...mod,
		})
	}
}

import { UserId, User, Users } from '../../../lib/collections/Users'
import { OrganizationId, Organizations } from '../../../lib/collections/Organization'
import { PeripheralDevice, PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import { cacheResult, isProtectedString, clearCacheResult } from '../../../lib/lib'
import { LIMIT_CACHE_TIME } from './security'
import { profiler } from '../../api/profiler'

export interface Credentials {
	userId: UserId | null
	token?: string
}

/**
 * A minimal set of properties about the user.
 * We keep it small so that we don't cache too much in memory or have to invalidate the credentials when something insignificant changes
 */
export type ResolvedUser = Pick<User, '_id' | 'organizationId' | 'superAdmin'>

/**
 * A minimal set of properties about the OeripheralDevice.
 * We keep it small so that we don't cache too much in memory or have to invalidate the credentials when something insignificant changes
 */
export type ResolvedPeripheralDevice = Pick<PeripheralDevice, '_id' | 'organizationId' | 'token'>

export interface ResolvedCredentials {
	user?: ResolvedUser
	organizationId: OrganizationId | null
	device?: ResolvedPeripheralDevice
}

export function resolveCredentials(cred: Credentials | ResolvedCredentials): ResolvedCredentials {
	const span = profiler.startSpan('security.lib.credentials')

	if (isResolvedCredentials(cred)) {
		span?.end()
		return cred
	}

	const resolved = cacheResult(
		credCacheName(cred),
		() => {
			const resolved: ResolvedCredentials = {
				organizationId: null,
			}

			if (cred.token && typeof cred.token !== 'string') cred.token = undefined
			if (cred.userId && !isProtectedString(cred.userId)) cred.userId = null

			// Lookup user, using userId:
			if (cred.userId && isProtectedString(cred.userId)) {
				const user = Users.findOne(cred.userId, {
					fields: {
						_id: 1,
						organizationId: 1,
						superAdmin: 1,
					},
				}) as ResolvedUser
				if (user) {
					resolved.user = user
					resolved.organizationId = user.organizationId
				}
			}
			// Lookup device, using token
			if (cred.token) {
				// TODO - token is not enforced to be unique and can be defined by a connecting gateway.
				// This is rather flawed in the current model..
				const device = PeripheralDevices.findOne(
					{ token: cred.token },
					{
						fields: {
							_id: 1,
							organizationId: 1,
							token: 1,
						},
					}
				) as ResolvedPeripheralDevice
				if (device) {
					resolved.device = device
					resolved.organizationId = device.organizationId
				}
			}

			// TODO: Implement user-token / API-key
			// Lookup user, using token
			// if (!resolved.user && !resolved.device && cred.token) {
			// 	user = Users.findOne({ token: cred.token})
			// 	if (user) resolved.user = user
			// }

			// Make sure the organizationId is valid
			if (resolved.organizationId) {
				const orgCount = Organizations.find(resolved.organizationId).count()
				if (orgCount === 0) {
					resolved.organizationId = null
				}
			}

			return resolved
		},
		LIMIT_CACHE_TIME
	)

	span?.end()
	return resolved
}
/** To be called whenever a user is changed */
export function resetCredentials(cred: Credentials): void {
	clearCacheResult(credCacheName(cred))
}
function credCacheName(cred: Credentials) {
	return `resolveCredentials_${cred.userId}_${cred.token}`
}
export function isResolvedCredentials(cred: Credentials | ResolvedCredentials): cred is ResolvedCredentials {
	const c = cred as ResolvedCredentials
	return !!(c.user || c.organizationId || c.device)
}

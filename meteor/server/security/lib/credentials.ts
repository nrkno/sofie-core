import { UserId, User, Users, DBUser } from '../../../lib/collections/Users'
import { DBOrganization, Organizations } from '../../../lib/collections/Organization'
import { PeripheralDevice, PeripheralDevices } from '../../../lib/collections/PeripheralDevices'
import { cacheResult, isProtectedString, clearCacheResult } from '../../../lib/lib'
import { LIMIT_CACHE_TIME } from './security'
import { profiler } from '../../api/profiler'

export interface Credentials {
	userId: UserId | null
	token?: string
}
export interface ResolvedCredentials {
	user?: User
	organization?: DBOrganization
	device?: PeripheralDevice
}
export interface ResolvedCredentialsWithUserAndOrganization {
	user: User
	organization: DBOrganization
	device?: PeripheralDevice
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
			const resolved: ResolvedCredentials = {}

			if (cred.token && typeof cred.token !== 'string') cred.token = undefined
			if (cred.userId && !isProtectedString(cred.userId)) cred.userId = null

			let user: DBUser | undefined = undefined
			// Lookup user, using userId:
			if (cred.userId && isProtectedString(cred.userId)) {
				user = Users.findOne(cred.userId)
				if (user) resolved.user = user
			}
			// Lookup device, using token
			if (cred.token) {
				const device = PeripheralDevices.findOne({ token: cred.token })
				if (device) {
					resolved.device = device
				}
			}

			// TODO: Implement user-token / API-key
			// Lookup user, using token
			// if (!resolved.user && !resolved.device && cred.token) {
			// 	user = Users.findOne({ token: cred.token})
			// 	if (user) resolved.user = user
			// }

			// Lookup organization, using user
			if (resolved.user && resolved.user.organizationId) {
				const org = Organizations.findOne(resolved.user.organizationId)
				if (org) {
					resolved.organization = org
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
	const c: any = cred
	return !!(c.user || c.organization || c.device)
}

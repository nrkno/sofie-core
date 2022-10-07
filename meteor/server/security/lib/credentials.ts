import { UserId, User, Users } from '../../../lib/collections/Users'
import { OrganizationId } from '../../../lib/collections/Organization'
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
export type ResolvedPeripheralDevice = Pick<PeripheralDevice, '_id' | 'organizationId' | 'token' | 'studioId'>

export interface ResolvedCredentials {
	organizationId: OrganizationId | null
	user?: ResolvedUser
	device?: ResolvedPeripheralDevice
}
export interface ResolvedUserCredentials {
	organizationId: OrganizationId
	user: ResolvedUser
}
export interface ResolvedPeripheralDeviceCredentials {
	organizationId: OrganizationId
	device: ResolvedPeripheralDevice
}

/**
 * Resolve the provided credentials, and retrieve the PeripheralDevice and Organization for the provided credentials.
 * @returns null if the PeripheralDevice was not found
 */
export async function resolveAuthenticatedPeripheralDevice(
	cred: Credentials
): Promise<ResolvedPeripheralDeviceCredentials | null> {
	const resolved = await resolveCredentials({ userId: null, token: cred.token })

	if (resolved.device && resolved.organizationId) {
		return {
			organizationId: resolved.organizationId,
			device: resolved.device,
		}
	} else {
		return null
	}
}

/**
 * Resolve the provided credentials, and retrieve the User and Organization for the provided credentials.
 * Note: this requies that the UserId came from a trusted source,it must not be from user input
 * @returns null if the user was not found
 */
export async function resolveAuthenticatedUser(cred: Credentials): Promise<ResolvedUserCredentials | null> {
	const resolved = await resolveCredentials({ userId: cred.userId })

	if (resolved.user && resolved.organizationId) {
		return {
			organizationId: resolved.organizationId,
			user: resolved.user,
		}
	} else {
		return null
	}
}

/**
 * Resolve the provided credentials/identifier, and fetch the authenticating document from the database.
 * Note: this requires that the provided UserId comes from an up-to-date location in meteor, it must not be from user input
 * @returns The resolved object. If the identifiers were invalid then this object will have no properties
 */
export async function resolveCredentials(cred: Credentials | ResolvedCredentials): Promise<ResolvedCredentials> {
	const span = profiler.startSpan('security.lib.credentials')

	if (isResolvedCredentials(cred)) {
		span?.end()
		return cred
	}

	const resolved = cacheResult(
		credCacheName(cred),
		async () => {
			const resolved: ResolvedCredentials = {
				organizationId: null,
			}

			if (cred.token && typeof cred.token !== 'string') cred.token = undefined
			if (cred.userId && !isProtectedString(cred.userId)) cred.userId = null

			// Lookup user, using userId:
			if (cred.userId && isProtectedString(cred.userId)) {
				const user = (await Users.findOneAsync(cred.userId, {
					fields: {
						_id: 1,
						organizationId: 1,
						superAdmin: 1,
					},
				})) as ResolvedUser
				if (user) {
					resolved.user = user
					resolved.organizationId = user.organizationId
				}
			}
			// Lookup device, using token
			if (cred.token) {
				// TODO - token is not enforced to be unique and can be defined by a connecting gateway.
				// This is rather flawed in the current model..
				const device = (await PeripheralDevices.findOneAsync(
					{ token: cred.token },
					{
						fields: {
							_id: 1,
							organizationId: 1,
							token: 1,
							studioId: 1,
						},
					}
				)) as ResolvedPeripheralDevice
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

			// // Make sure the organizationId is valid
			// if (resolved.organizationId) {
			// 	const org = (await Organizations.findOneAsync(resolved.organizationId, {
			// 		fields: { _id: 1 },
			// 	})) as Pick<DBOrganization, '_id'> | undefined
			// 	if (org) {
			// 		resolved.organizationId = null
			// 	}
			// }

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

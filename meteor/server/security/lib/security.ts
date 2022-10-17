import * as _ from 'underscore'
import { MongoQueryKey } from '../../../lib/typings/meteor'
import { Settings } from '../../../lib/Settings'
import { resolveCredentials, ResolvedCredentials, Credentials, isResolvedCredentials } from './credentials'
import { allAccess, noAccess, combineAccess, Access } from './access'
import { RundownPlaylist, RundownPlaylists } from '../../../lib/collections/RundownPlaylists'
import { Rundowns, Rundown } from '../../../lib/collections/Rundowns'
import { isProtectedString } from '../../../lib/lib'
import { Organizations, DBOrganization } from '../../../lib/collections/Organization'
import { PeripheralDevices, PeripheralDevice } from '../../../lib/collections/PeripheralDevices'
import { ShowStyleVariants, ShowStyleVariant } from '../../../lib/collections/ShowStyleVariants'
import { profiler } from '../../api/profiler'
import {
	fetchShowStyleBasesLight,
	fetchStudioLight,
	ShowStyleBaseLight,
	StudioLight,
} from '../../../lib/collections/optimizations'
import {
	OrganizationId,
	PeripheralDeviceId,
	RundownId,
	RundownPlaylistId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
	UserId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'

export const LIMIT_CACHE_TIME = 1000 * 60 * 15 // 15 minutes

// TODO: add caching

/**
 * Grant access to everything if security is disabled
 * @returns Access granting access to everything
 */
export function allowAccessToAnythingWhenSecurityDisabled(): Access<null> {
	if (!Settings.enableUserAccounts) return allAccess(null, 'No security')
	else return noAccess('Security is enabled')
}

/**
 * Check if access is allowed to the coreSystem collection
 * @param cred0 Credentials to check
 */
export async function allowAccessToCoreSystem(cred: ResolvedCredentials): Promise<Access<null>> {
	if (!Settings.enableUserAccounts) return allAccess(null, 'No security')

	return AccessRules.accessCoreSystem(cred)
}

/**
 * Check if access is allowed to a User, and that user is the current User
 * @param cred0 Credentials to check
 */
export async function allowAccessToCurrentUser(
	cred0: Credentials | ResolvedCredentials,
	userId: UserId
): Promise<Access<null>> {
	if (!Settings.enableUserAccounts) return allAccess(null, 'No security')
	if (!userId) return noAccess('userId missing')
	if (!isProtectedString(userId)) return noAccess('userId is not a string')

	return {
		...(await AccessRules.accessCurrentUser(cred0, userId)),
		insert: false, // only allowed through methods
		update: false, // only allowed through methods
		remove: false, // only allowed through methods
	}
}

/**
 * Check if access is allowed to the systemStatus collection
 * @param cred0 Credentials to check
 */
export async function allowAccessToSystemStatus(cred0: Credentials | ResolvedCredentials): Promise<Access<null>> {
	if (!Settings.enableUserAccounts) return allAccess(null, 'No security')

	return {
		...AccessRules.accessSystemStatus(cred0),
		insert: false, // only allowed through methods
		update: false, // only allowed through methods
		remove: false, // only allowed through methods
	}
}

export async function allowAccessToOrganization(
	cred0: Credentials | ResolvedCredentials,
	organizationId: OrganizationId | null
): Promise<Access<DBOrganization | null>> {
	if (!Settings.enableUserAccounts) return allAccess(null, 'No security')
	if (!organizationId) return noAccess('organizationId not set')
	if (!isProtectedString(organizationId)) return noAccess('organizationId is not a string')
	const cred = await resolveCredentials(cred0)

	const organization = Organizations.findOne(organizationId)
	if (!organization) return noAccess('Organization not found')

	return {
		...AccessRules.accessOrganization(organization, cred),
		insert: false, // only allowed through methods
		remove: false, // only allowed through methods
	}
}
export async function allowAccessToShowStyleBase(
	cred0: Credentials | ResolvedCredentials,
	showStyleBaseId: MongoQueryKey<ShowStyleBaseId>
): Promise<Access<ShowStyleBaseLight | null>> {
	if (!Settings.enableUserAccounts) return allAccess(null, 'No security')
	if (!showStyleBaseId) return noAccess('showStyleBaseId not set')
	const cred = await resolveCredentials(cred0)

	const showStyleBases = await fetchShowStyleBasesLight({
		_id: showStyleBaseId,
	})
	let access: Access<ShowStyleBaseLight | null> = allAccess(null)
	for (const showStyleBase of showStyleBases) {
		access = combineAccess(access, AccessRules.accessShowStyleBase(showStyleBase, cred))
	}
	return {
		...access,
		insert: false, // only allowed through methods
		remove: false, // only allowed through methods
	}
}
export async function allowAccessToShowStyleVariant(
	cred0: Credentials | ResolvedCredentials,
	showStyleVariantId: MongoQueryKey<ShowStyleVariantId>
): Promise<Access<ShowStyleVariant | null>> {
	if (!Settings.enableUserAccounts) return allAccess(null, 'No security')
	if (!showStyleVariantId) return noAccess('showStyleVariantId not set')
	const cred = await resolveCredentials(cred0)

	const showStyleVariants = await ShowStyleVariants.findFetchAsync({
		_id: showStyleVariantId,
	})
	const showStyleBaseIds = _.uniq(_.map(showStyleVariants, (v) => v.showStyleBaseId))
	const showStyleBases = await fetchShowStyleBasesLight({
		_id: { $in: showStyleBaseIds },
	})
	let access: Access<ShowStyleBaseLight | null> = allAccess(null)
	for (const showStyleBase of showStyleBases) {
		access = combineAccess(access, AccessRules.accessShowStyleBase(showStyleBase, cred))
	}
	return { ...access, document: _.last(showStyleVariants) || null }
}
export async function allowAccessToStudio(
	cred0: Credentials | ResolvedCredentials,
	studioId: StudioId
): Promise<Access<StudioLight | null>> {
	if (!Settings.enableUserAccounts) return allAccess(null, 'No security')
	if (!studioId) return noAccess('studioId not set')
	if (!isProtectedString(studioId)) return noAccess('studioId is not a string')
	const cred = await resolveCredentials(cred0)

	const studio = await fetchStudioLight(studioId)
	if (!studio) return noAccess('Studio not found')

	return {
		...AccessRules.accessStudio(studio, cred),
		insert: false, // only allowed through methods
		remove: false, // only allowed through methods
	}
}
export async function allowAccessToRundownPlaylist(
	cred0: Credentials | ResolvedCredentials,
	playlistId: RundownPlaylistId
): Promise<Access<RundownPlaylist | null>> {
	if (!Settings.enableUserAccounts) return allAccess(null, 'No security')
	if (!playlistId) return noAccess('playlistId not set')
	const cred = await resolveCredentials(cred0)

	const playlist = await RundownPlaylists.findOneAsync(playlistId)
	if (playlist) {
		return AccessRules.accessRundownPlaylist(playlist, cred)
	} else {
		return allAccess(null)
	}
}
export async function allowAccessToRundown(
	cred0: Credentials | ResolvedCredentials,
	rundownId: MongoQueryKey<RundownId>
): Promise<Access<Rundown | null>> {
	const access = await allowAccessToRundownContent(cred0, rundownId)
	return {
		...access,
		insert: false, // only allowed through methods
		update: false, // only allowed through methods
		remove: false, // only allowed through methods
	}
}
export async function allowAccessToRundownContent(
	cred0: Credentials | ResolvedCredentials,
	rundownId: MongoQueryKey<RundownId>
): Promise<Access<Rundown | null>> {
	if (!Settings.enableUserAccounts) return allAccess(null, 'No security')
	if (!rundownId) return noAccess('rundownId missing')
	const cred = await resolveCredentials(cred0)

	const rundowns = await Rundowns.findFetchAsync({ _id: rundownId })
	let access: Access<Rundown | null> = allAccess(null)
	for (const rundown of rundowns) {
		// TODO - this is reeally inefficient on db queries
		access = combineAccess(access, await AccessRules.accessRundown(rundown, cred))
	}
	return access
}
export async function allowAccessToPeripheralDevice(
	cred0: Credentials | ResolvedCredentials,
	deviceId: PeripheralDeviceId
): Promise<Access<PeripheralDevice | null>> {
	if (!deviceId) return noAccess('deviceId missing')
	if (!isProtectedString(deviceId)) return noAccess('deviceId is not a string')

	const device = await PeripheralDevices.findOneAsync(deviceId)
	if (!device) return noAccess('Device not found')

	const access = await allowAccessToPeripheralDeviceContent(cred0, device)
	return {
		...access,
		insert: false, // only allowed through methods
		remove: false, // only allowed through methods
	}
}

export async function allowAccessToPeripheralDeviceContent(
	cred0: Credentials | ResolvedCredentials,
	device: PeripheralDevice
): Promise<Access<PeripheralDevice | null>> {
	const span = profiler.startSpan('security.lib.security.allowAccessToPeripheralDeviceContent')
	if (!Settings.enableUserAccounts) return allAccess(null, 'No security')
	const cred = await resolveCredentials(cred0)

	const access = AccessRules.accessPeripheralDevice(device, cred)

	span?.end()
	return access
}

namespace AccessRules {
	/**
	 * Check if access is allowed to the coreSystem collection
	 * @param cred0 Credentials to check
	 */
	export function accessCoreSystem(cred: ResolvedCredentials): Access<null> {
		if (cred.user && cred.user.superAdmin) {
			return {
				...allAccess(null),
				insert: false, // only allowed through methods
				remove: false, // only allowed through methods
			}
		} else {
			return {
				...noAccess('User is not superAdmin'),
				read: true,
			}
		}
	}

	/**
	 * Check the allowed access to a user (and verify that user is the current user)
	 * @param cred0 Credentials to check
	 * @param userId User to check access to
	 */
	export async function accessCurrentUser(
		cred0: Credentials | ResolvedCredentials,
		userId: UserId
	): Promise<Access<null>> {
		let credUserId: UserId | undefined = undefined
		if (isResolvedCredentials(cred0) && cred0.user) {
			credUserId = cred0.user._id
		} else if (!isResolvedCredentials(cred0) && cred0.userId) {
			credUserId = cred0.userId
		} else {
			const cred = await resolveCredentials(cred0)
			if (!cred.user) return noAccess('User in cred not found')
			credUserId = cred.user._id
		}

		if (credUserId) {
			if (credUserId === userId) {
				// TODO: user role access
				return allAccess(null)
			} else return noAccess('Not accessing current user')
		} else return noAccess('Requested user not found')
	}

	export function accessSystemStatus(_cred0: Credentials | ResolvedCredentials): Access<null> {
		// No restrictions on systemStatus
		return allAccess(null)
	}
	// export function accessUser (cred: ResolvedCredentials, user: User): Access<User> {
	// 	if (!cred.organizationId) return noAccess('No organization in credentials')
	// 	if (user.organizationId === cred.organizationId) {
	// 		// TODO: user role access
	// 		return allAccess()
	// 	} else return noAccess('User is not in the same organization as requested user')
	// }
	export function accessOrganization(
		organization: DBOrganization,
		cred: ResolvedCredentials
	): Access<DBOrganization> {
		if (!cred.organizationId) return noAccess('No organization in credentials')
		if (organization._id === cred.organizationId) {
			// TODO: user role access
			return allAccess(organization)
		} else return noAccess(`User is not in the organization "${organization._id}"`)
	}
	export function accessShowStyleBase(
		showStyleBase: ShowStyleBaseLight,
		cred: ResolvedCredentials
	): Access<ShowStyleBaseLight> {
		if (!showStyleBase.organizationId) return noAccess('ShowStyleBase has no organization')
		if (!cred.organizationId) return noAccess('No organization in credentials')
		if (showStyleBase.organizationId === cred.organizationId) {
			// TODO: user role access
			return allAccess(showStyleBase)
		} else return noAccess(`User is not in the same organization as the showStyleBase "${showStyleBase._id}"`)
	}
	export function accessStudio(studio: StudioLight, cred: ResolvedCredentials): Access<StudioLight> {
		if (!studio.organizationId) return noAccess('Studio has no organization')
		if (!cred.organizationId) return noAccess('No organization in credentials')
		if (studio.organizationId === cred.organizationId) {
			// TODO: user role access
			return allAccess(studio)
		} else return noAccess(`User is not in the same organization as the studio ${studio._id}`)
	}
	export async function accessRundownPlaylist(
		playlist: RundownPlaylist,
		cred: ResolvedCredentials
	): Promise<Access<RundownPlaylist>> {
		const studio = await fetchStudioLight(playlist.studioId)
		if (!studio) return noAccess(`Studio of playlist "${playlist._id}" not found`)
		return { ...accessStudio(studio, cred), document: playlist }
	}
	export async function accessRundown(rundown: Rundown, cred: ResolvedCredentials): Promise<Access<Rundown>> {
		const playlist = await RundownPlaylists.findOneAsync(rundown.playlistId)
		if (!playlist) return noAccess(`Rundown playlist of rundown "${rundown._id}" not found`)
		return { ...(await accessRundownPlaylist(playlist, cred)), document: rundown }
	}
	export function accessPeripheralDevice(
		device: PeripheralDevice,
		cred: ResolvedCredentials
	): Access<PeripheralDevice> {
		if (!cred.organizationId) return noAccess('No organization in credentials')
		if (!device.organizationId) return noAccess('Device has no organizationId')
		if (device.organizationId === cred.organizationId) {
			return allAccess(device)
		} else return noAccess(`Device "${device._id}" is not in the same organization as user`)
	}
}

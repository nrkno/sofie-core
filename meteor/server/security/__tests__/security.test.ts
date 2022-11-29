import '../../../__mocks__/_extendJest'

import { MethodContext } from '../../../lib/api/methods'
import { DBOrganization, Organizations } from '../../../lib/collections/Organization'
import { User, Users } from '../../../lib/collections/Users'
import { protectString } from '../../../lib/lib'
import { Settings } from '../../../lib/Settings'
import { DefaultEnvironment, setupDefaultStudioEnvironment } from '../../../__mocks__/helpers/database'
import { beforeAllInFiber, testInFiber } from '../../../__mocks__/helpers/jest'
import { BucketsAPI } from '../../api/buckets'
import { storeSystemSnapshot } from '../../api/snapshot'
import { BucketSecurity } from '../buckets'
import { Credentials } from '../lib/credentials'
import { NoSecurityReadAccess } from '../noSecurity'
import { OrganizationContentWriteAccess, OrganizationReadAccess } from '../organization'
import { StudioContentWriteAccess } from '../studio'
import { OrganizationId, UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'

describe('Security', () => {
	function getContext(cred: Credentials): MethodContext {
		return {
			...cred,

			isSimulation: false,
			connection: null,
			setUserId: (_userId: string) => {
				// Nothing
			},
			unblock: () => {
				// Nothing
			},
		}
	}
	function getUser(userId: UserId, orgId: OrganizationId): User {
		return {
			_id: userId,
			organizationId: orgId,

			createdAt: '',
			services: {
				password: {
					bcrypt: 'abc',
				},
			},
			username: 'username',
			emails: [{ address: 'email.com', verified: false }],
			profile: {
				name: 'John Doe',
			},
		}
	}
	function getOrg(id: string): DBOrganization {
		return {
			_id: protectString(id),
			name: 'The Company',

			userRoles: {
				userA: {
					admin: true,
				},
			},

			created: 0,
			modified: 0,

			applications: [],
			broadcastMediums: [],
		}
	}
	async function changeEnableUserAccounts(fcn: () => Promise<void>) {
		try {
			Settings.enableUserAccounts = false
			await fcn()
			Settings.enableUserAccounts = true
			await fcn()
		} catch (e) {
			console.log(`Error happened when Settings.enableUserAccounts = ${Settings.enableUserAccounts}`)
			throw e
		}
	}

	const idCreator: UserId = protectString('userCreator')
	const idUserB: UserId = protectString('userB')
	const idNonExisting: UserId = protectString('userNonExistant')
	const idInWrongOrg: UserId = protectString('userInWrongOrg')
	const idSuperAdmin: UserId = protectString('userSuperAdmin')
	const idSuperAdminInOtherOrg: UserId = protectString('userSuperAdminOther')

	// Credentials for various users:
	const nothing: MethodContext = getContext({ userId: null })
	const creator: MethodContext = getContext({ userId: idCreator })
	const userB: MethodContext = getContext({ userId: idUserB })
	const nonExisting: MethodContext = getContext({ userId: idNonExisting })
	const wrongOrg: MethodContext = getContext({ userId: idInWrongOrg })
	const superAdmin: MethodContext = getContext({ userId: idSuperAdmin })
	const otherSuperAdmin: MethodContext = getContext({ userId: idSuperAdminInOtherOrg })

	const unknownId = protectString('unknown')

	const org0: DBOrganization = getOrg('org0')
	const org1: DBOrganization = getOrg('org1')
	const org2: DBOrganization = getOrg('org2')

	async function expectReadNotAllowed(fcn: () => Promise<boolean>) {
		if (Settings.enableUserAccounts === false) return expectReadAllowed(fcn)
		return expect(fcn()).resolves.toEqual(false)
	}
	async function expectReadAllowed(fcn: () => Promise<boolean>) {
		return expect(fcn()).resolves.toEqual(true)
	}
	async function expectNotAllowed(fcn: () => Promise<any>) {
		if (Settings.enableUserAccounts === false) return expectAllowed(fcn)
		return expect(fcn()).rejects.toBeTruthy()
	}
	async function expectNotLoggedIn(fcn: () => Promise<any>) {
		if (Settings.enableUserAccounts === false) return expectAllowed(fcn)
		return expect(fcn()).rejects.toMatchToString(/not logged in/i)
	}
	async function expectNotFound(fcn: () => Promise<any>) {
		// if (Settings.enableUserAccounts === false) return expectAllowed(fcn)
		return expect(fcn()).rejects.toMatchToString(/not found/i)
	}
	async function expectAllowed(fcn: () => Promise<any>) {
		return expect(fcn()).resolves.not.toBeUndefined()
	}
	let env: DefaultEnvironment
	beforeAllInFiber(async () => {
		env = await setupDefaultStudioEnvironment(org0._id)

		Organizations.insert(org0)
		Organizations.insert(org1)
		Organizations.insert(org2)

		Users.insert(getUser(idCreator, org0._id))
		Users.insert(getUser(idUserB, org0._id))
		Users.insert(getUser(idInWrongOrg, org1._id))
		Users.insert({ ...getUser(idSuperAdmin, org0._id), superAdmin: true })
		Users.insert({ ...getUser(idSuperAdminInOtherOrg, org2._id), superAdmin: true })
	})

	testInFiber('Buckets', async () => {
		const access = await StudioContentWriteAccess.bucket(creator, env.studio._id)
		const bucket = await BucketsAPI.createNewBucket(access, 'myBucket')

		await changeEnableUserAccounts(async () => {
			await expectReadAllowed(async () => BucketSecurity.allowReadAccess(creator, bucket._id))
			await expectAllowed(async () => BucketSecurity.allowWriteAccess(creator, bucket._id))
			// expectAccessAllowed(() => BucketSecurity.allowWriteAccessPiece({ _id: bucket._id }, credUserA))

			// Unknown bucket:
			await expectNotFound(async () => BucketSecurity.allowReadAccess(creator, unknownId))
			await expectNotFound(async () => BucketSecurity.allowWriteAccess(creator, unknownId))
			await expectNotFound(async () => BucketSecurity.allowWriteAccessPiece(creator, unknownId))

			// Not logged in:
			await expectReadNotAllowed(async () => BucketSecurity.allowReadAccess(nothing, bucket._id))
			await expectNotLoggedIn(async () => BucketSecurity.allowWriteAccess(nothing, bucket._id))
			// expectAccessNotLoggedIn(() => BucketSecurity.allowWriteAccessPiece({ _id: bucket._id }, credNothing))

			// Non existing user:
			await expectReadNotAllowed(async () => BucketSecurity.allowReadAccess(nonExisting, bucket._id))
			await expectNotLoggedIn(async () => BucketSecurity.allowWriteAccess(nonExisting, bucket._id))
			// expectAccess(() => BucketSecurity.allowWriteAccessPiece({ _id: bucket._id }, credNonExistingUser))

			// Other user in same org:
			await expectReadAllowed(async () => BucketSecurity.allowReadAccess(userB, bucket._id))
			await expectAllowed(async () => BucketSecurity.allowWriteAccess(userB, bucket._id))
			// expectAccess(() => BucketSecurity.allowWriteAccessPiece({ _id: bucket._id }, credUserB))

			// Other user in other org:
			await expectReadNotAllowed(async () => BucketSecurity.allowReadAccess(wrongOrg, bucket._id))
			await expectNotAllowed(async () => BucketSecurity.allowWriteAccess(wrongOrg, bucket._id))
			// expectAccess(() => BucketSecurity.allowWriteAccessPiece({ _id: bucket._id }, credUserInWrongOrganization))
		})
	})

	testInFiber('NoSecurity', async () => {
		await changeEnableUserAccounts(async () => {
			await expectAllowed(async () => NoSecurityReadAccess.any())
		})
	})
	testInFiber('Organization', async () => {
		const snapshotId = await storeSystemSnapshot(superAdmin, env.studio._id, 'for test')

		await changeEnableUserAccounts(async () => {
			const selectorId = org0._id
			const selectorOrg = { organizationId: org0._id }

			// === Read access: ===

			// No user credentials:
			await expectReadNotAllowed(async () => OrganizationReadAccess.adminUsers(selectorId, nothing))
			await expectReadNotAllowed(async () => OrganizationReadAccess.organization(selectorId, nothing))
			await expectReadNotAllowed(async () => OrganizationReadAccess.organizationContent(selectorId, nothing))
			// Normal user:
			await expectReadAllowed(async () => OrganizationReadAccess.adminUsers(selectorId, creator))
			await expectReadAllowed(async () => OrganizationReadAccess.organization(selectorId, creator))
			await expectReadAllowed(async () => OrganizationReadAccess.organizationContent(selectorId, creator))
			// Other normal user:
			await expectReadAllowed(async () => OrganizationReadAccess.adminUsers(selectorId, userB))
			await expectReadAllowed(async () => OrganizationReadAccess.organization(selectorId, userB))
			await expectReadAllowed(async () => OrganizationReadAccess.organizationContent(selectorId, userB))
			// Non-existing user:
			await expectReadNotAllowed(async () => OrganizationReadAccess.adminUsers(selectorId, nonExisting))
			await expectReadNotAllowed(async () => OrganizationReadAccess.organization(selectorId, nonExisting))
			await expectReadNotAllowed(async () => OrganizationReadAccess.organizationContent(selectorId, nonExisting))
			// User in wrong organization:
			await expectReadNotAllowed(async () => OrganizationReadAccess.adminUsers(selectorId, wrongOrg))
			await expectReadNotAllowed(async () => OrganizationReadAccess.organization(selectorId, wrongOrg))
			await expectReadNotAllowed(async () => OrganizationReadAccess.organizationContent(selectorId, wrongOrg))
			// SuperAdmin:
			await expectReadNotAllowed(async () => OrganizationReadAccess.adminUsers(selectorId, otherSuperAdmin))
			await expectReadNotAllowed(async () => OrganizationReadAccess.organization(selectorId, otherSuperAdmin))
			await expectReadNotAllowed(async () =>
				OrganizationReadAccess.organizationContent(selectorId, otherSuperAdmin)
			)

			// === Write access: ===

			// No user credentials:
			await expectNotLoggedIn(async () => OrganizationContentWriteAccess.organization(nothing, org0._id))
			await expectNotLoggedIn(async () => OrganizationContentWriteAccess.studio(nothing, env.studio))
			await expectNotLoggedIn(async () => OrganizationContentWriteAccess.evaluation(nothing))
			await expectNotLoggedIn(async () => OrganizationContentWriteAccess.mediaWorkFlows(nothing))
			await expectNotLoggedIn(async () =>
				OrganizationContentWriteAccess.blueprint(nothing, env.studioBlueprint._id)
			)
			await expectNotLoggedIn(async () => OrganizationContentWriteAccess.snapshot(nothing, snapshotId))
			await expectNotLoggedIn(async () => OrganizationContentWriteAccess.dataFromSnapshot(nothing, org0._id))
			await expectNotLoggedIn(async () =>
				OrganizationContentWriteAccess.showStyleBase(nothing, env.showStyleBaseId)
			)
			await expectNotLoggedIn(async () => OrganizationContentWriteAccess.translationBundle(nothing, selectorOrg))

			// Normal user:
			await expectAllowed(async () => OrganizationContentWriteAccess.organization(creator, org0._id))
			await expectAllowed(async () => OrganizationContentWriteAccess.studio(creator, env.studio))
			await expectAllowed(async () => OrganizationContentWriteAccess.evaluation(creator))
			await expectAllowed(async () => OrganizationContentWriteAccess.mediaWorkFlows(creator))
			await expectAllowed(async () => OrganizationContentWriteAccess.blueprint(creator, env.studioBlueprint._id))
			await expectAllowed(async () => OrganizationContentWriteAccess.snapshot(creator, snapshotId))
			await expectAllowed(async () => OrganizationContentWriteAccess.dataFromSnapshot(creator, org0._id))
			await expectAllowed(async () => OrganizationContentWriteAccess.showStyleBase(creator, env.showStyleBaseId))
			await expectAllowed(async () => OrganizationContentWriteAccess.translationBundle(creator, selectorOrg))
			// Other normal user:
			await expectAllowed(async () => OrganizationContentWriteAccess.organization(userB, org0._id))
			await expectAllowed(async () => OrganizationContentWriteAccess.studio(userB, env.studio))
			await expectAllowed(async () => OrganizationContentWriteAccess.evaluation(userB))
			await expectAllowed(async () => OrganizationContentWriteAccess.mediaWorkFlows(userB))
			await expectAllowed(async () => OrganizationContentWriteAccess.blueprint(userB, env.studioBlueprint._id))
			await expectAllowed(async () => OrganizationContentWriteAccess.snapshot(userB, snapshotId))
			await expectAllowed(async () => OrganizationContentWriteAccess.dataFromSnapshot(userB, org0._id))
			await expectAllowed(async () => OrganizationContentWriteAccess.showStyleBase(userB, env.showStyleBaseId))
			await expectAllowed(async () => OrganizationContentWriteAccess.translationBundle(userB, selectorOrg))
			// Non-existing user:
			await expectNotLoggedIn(async () => OrganizationContentWriteAccess.organization(nonExisting, org0._id))
			await expectNotLoggedIn(async () => OrganizationContentWriteAccess.studio(nonExisting, env.studio))
			await expectNotLoggedIn(async () => OrganizationContentWriteAccess.evaluation(nonExisting))
			await expectNotLoggedIn(async () => OrganizationContentWriteAccess.mediaWorkFlows(nonExisting))
			await expectNotLoggedIn(async () =>
				OrganizationContentWriteAccess.blueprint(nonExisting, env.studioBlueprint._id)
			)
			await expectNotLoggedIn(async () => OrganizationContentWriteAccess.snapshot(nonExisting, snapshotId))
			await expectNotLoggedIn(async () => OrganizationContentWriteAccess.dataFromSnapshot(nonExisting, org0._id))
			await expectNotLoggedIn(async () =>
				OrganizationContentWriteAccess.showStyleBase(nonExisting, env.showStyleBaseId)
			)
			await expectNotLoggedIn(async () =>
				OrganizationContentWriteAccess.translationBundle(nonExisting, selectorOrg)
			)
			// User in wrong organization:
			await expectNotAllowed(async () => OrganizationContentWriteAccess.organization(wrongOrg, org0._id))
			await expectNotAllowed(async () => OrganizationContentWriteAccess.studio(wrongOrg, env.studio))
			// expectNotAllowed(async() => OrganizationContentWriteAccess.evaluation(wrongOrg))
			// expectNotAllowed(async() => OrganizationContentWriteAccess.mediaWorkFlows(wrongOrg))
			await expectNotAllowed(async () =>
				OrganizationContentWriteAccess.blueprint(wrongOrg, env.studioBlueprint._id)
			)
			await expectNotAllowed(async () => OrganizationContentWriteAccess.snapshot(wrongOrg, snapshotId))
			await expectNotAllowed(async () => OrganizationContentWriteAccess.dataFromSnapshot(wrongOrg, org0._id))
			await expectNotAllowed(async () =>
				OrganizationContentWriteAccess.showStyleBase(wrongOrg, env.showStyleBaseId)
			)
			await expectNotAllowed(async () => OrganizationContentWriteAccess.translationBundle(wrongOrg, selectorOrg))

			// Other SuperAdmin
			await expectNotAllowed(async () => OrganizationContentWriteAccess.organization(otherSuperAdmin, org0._id))
			await expectNotAllowed(async () => OrganizationContentWriteAccess.studio(otherSuperAdmin, env.studio))
			// expectNotAllowed(async() => OrganizationContentWriteAccess.evaluation(otherSuperAdmin))
			// expectNotAllowed(async() => OrganizationContentWriteAccess.mediaWorkFlows(otherSuperAdmin))
			await expectNotAllowed(async () =>
				OrganizationContentWriteAccess.blueprint(otherSuperAdmin, env.studioBlueprint._id)
			)
			await expectNotAllowed(async () => OrganizationContentWriteAccess.snapshot(otherSuperAdmin, snapshotId))
			await expectNotAllowed(async () =>
				OrganizationContentWriteAccess.dataFromSnapshot(otherSuperAdmin, org0._id)
			)
			await expectNotAllowed(async () =>
				OrganizationContentWriteAccess.showStyleBase(otherSuperAdmin, env.showStyleBaseId)
			)
			await expectNotAllowed(async () =>
				OrganizationContentWriteAccess.translationBundle(otherSuperAdmin, selectorOrg)
			)
		})
	})
})

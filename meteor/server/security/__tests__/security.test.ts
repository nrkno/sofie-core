import { MethodContext } from '../../../lib/api/methods'
import { setCoreSystemStorePath } from '../../../lib/collections/CoreSystem'
import { DBOrganization, OrganizationId, Organizations } from '../../../lib/collections/Organization'
import { User, Users } from '../../../lib/collections/Users'
import { protectString, waitForPromise } from '../../../lib/lib'
import { Settings } from '../../../lib/Settings'
import { UserId } from '../../../lib/typings/meteor'
import { DefaultEnvironment, setupDefaultStudioEnvironment } from '../../../__mocks__/helpers/database'
import { beforeAllInFiber, testInFiber } from '../../../__mocks__/helpers/jest'
import { BucketsAPI } from '../../api/buckets'
import { storeSystemSnapshot } from '../../api/snapshot'
import { BucketSecurity } from '../buckets'
import { Credentials } from '../lib/credentials'
import { NoSecurityReadAccess } from '../noSecurity'
import { OrganizationContentWriteAccess, OrganizationReadAccess } from '../organization'
import { StudioContentWriteAccess } from '../studio'

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
	function changeEnableUserAccounts(fcn: () => void) {
		try {
			Settings.enableUserAccounts = false
			fcn()
			Settings.enableUserAccounts = true
			fcn()
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

	function expectReadNotAllowed(fcn: () => Promise<boolean>) {
		if (Settings.enableUserAccounts === false) return expectReadAllowed(fcn)
		expect(waitForPromise(fcn())).toEqual(false)
	}
	function expectReadAllowed(fcn: () => Promise<boolean>) {
		expect(waitForPromise(fcn())).toEqual(true)
	}
	function expectNotAllowed(fcn: () => Promise<any>) {
		if (Settings.enableUserAccounts === false) return expectAllowed(fcn)
		expect(() => waitForPromise(fcn)).toThrowError()
	}
	function expectNotLoggedIn(fcn: () => Promise<any>) {
		if (Settings.enableUserAccounts === false) return expectAllowed(fcn)
		expect(() => waitForPromise(fcn)).toThrowError(/not logged in/i)
	}
	function expectNotFound(fcn: () => Promise<any>) {
		// if (Settings.enableUserAccounts === false) return expectAllowed(fcn)
		expect(() => waitForPromise(fcn)).toThrowError(/not found/i)
	}
	function expectAllowed(fcn: () => Promise<any>) {
		expect(() => waitForPromise(fcn)).not.toThrowError()
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

		changeEnableUserAccounts(() => {
			expectReadAllowed(async () => BucketSecurity.allowReadAccess(creator, bucket._id))
			expectAllowed(async () => BucketSecurity.allowWriteAccess(creator, bucket._id))
			// expectAccessAllowed(() => BucketSecurity.allowWriteAccessPiece({ _id: bucket._id }, credUserA))

			// Unknown bucket:
			expectNotFound(async () => BucketSecurity.allowReadAccess(creator, unknownId))
			expectNotFound(async () => BucketSecurity.allowWriteAccess(creator, unknownId))
			expectNotFound(async () => BucketSecurity.allowWriteAccessPiece(creator, unknownId))

			// Not logged in:
			expectReadNotAllowed(async () => BucketSecurity.allowReadAccess(nothing, bucket._id))
			expectNotLoggedIn(async () => BucketSecurity.allowWriteAccess(nothing, bucket._id))
			// expectAccessNotLoggedIn(() => BucketSecurity.allowWriteAccessPiece({ _id: bucket._id }, credNothing))

			// Non existing user:
			expectReadNotAllowed(async () => BucketSecurity.allowReadAccess(nonExisting, bucket._id))
			expectNotLoggedIn(async () => BucketSecurity.allowWriteAccess(nonExisting, bucket._id))
			// expectAccess(() => BucketSecurity.allowWriteAccessPiece({ _id: bucket._id }, credNonExistingUser))

			// Other user in same org:
			expectReadAllowed(async () => BucketSecurity.allowReadAccess(userB, bucket._id))
			expectAllowed(async () => BucketSecurity.allowWriteAccess(userB, bucket._id))
			// expectAccess(() => BucketSecurity.allowWriteAccessPiece({ _id: bucket._id }, credUserB))

			// Other user in other org:
			expectReadNotAllowed(async () => BucketSecurity.allowReadAccess(wrongOrg, bucket._id))
			expectNotAllowed(async () => BucketSecurity.allowWriteAccess(wrongOrg, bucket._id))
			// expectAccess(() => BucketSecurity.allowWriteAccessPiece({ _id: bucket._id }, credUserInWrongOrganization))
		})
	})

	testInFiber('NoSecurity', () => {
		changeEnableUserAccounts(() => {
			expectAllowed(async () => NoSecurityReadAccess.any())
		})
	})
	testInFiber('Organization', async () => {
		setCoreSystemStorePath('/non-existent-path/')
		const snapshotId = await storeSystemSnapshot(superAdmin, env.studio._id, 'for test')

		changeEnableUserAccounts(() => {
			const selectorId = org0._id
			const selectorOrg = { organizationId: org0._id }

			// === Read access: ===

			// No user credentials:
			expectReadNotAllowed(async () => OrganizationReadAccess.adminUsers(selectorId, nothing))
			expectReadNotAllowed(async () => OrganizationReadAccess.organization(selectorId, nothing))
			expectReadNotAllowed(async () => OrganizationReadAccess.organizationContent(selectorId, nothing))
			// Normal user:
			expectReadAllowed(async () => OrganizationReadAccess.adminUsers(selectorId, creator))
			expectReadAllowed(async () => OrganizationReadAccess.organization(selectorId, creator))
			expectReadAllowed(async () => OrganizationReadAccess.organizationContent(selectorId, creator))
			// Other normal user:
			expectReadAllowed(async () => OrganizationReadAccess.adminUsers(selectorId, userB))
			expectReadAllowed(async () => OrganizationReadAccess.organization(selectorId, userB))
			expectReadAllowed(async () => OrganizationReadAccess.organizationContent(selectorId, userB))
			// Non-existing user:
			expectReadNotAllowed(async () => OrganizationReadAccess.adminUsers(selectorId, nonExisting))
			expectReadNotAllowed(async () => OrganizationReadAccess.organization(selectorId, nonExisting))
			expectReadNotAllowed(async () => OrganizationReadAccess.organizationContent(selectorId, nonExisting))
			// User in wrong organization:
			expectReadNotAllowed(async () => OrganizationReadAccess.adminUsers(selectorId, wrongOrg))
			expectReadNotAllowed(async () => OrganizationReadAccess.organization(selectorId, wrongOrg))
			expectReadNotAllowed(async () => OrganizationReadAccess.organizationContent(selectorId, wrongOrg))
			// SuperAdmin:
			expectReadNotAllowed(async () => OrganizationReadAccess.adminUsers(selectorId, otherSuperAdmin))
			expectReadNotAllowed(async () => OrganizationReadAccess.organization(selectorId, otherSuperAdmin))
			expectReadNotAllowed(async () => OrganizationReadAccess.organizationContent(selectorId, otherSuperAdmin))

			// === Write access: ===

			// No user credentials:
			expectNotLoggedIn(async () => OrganizationContentWriteAccess.organization(nothing, org0._id))
			expectNotLoggedIn(async () => OrganizationContentWriteAccess.studio(nothing, env.studio))
			expectNotLoggedIn(async () => OrganizationContentWriteAccess.evaluation(nothing))
			expectNotLoggedIn(async () => OrganizationContentWriteAccess.mediaWorkFlows(nothing))
			expectNotLoggedIn(async () => OrganizationContentWriteAccess.blueprint(nothing, env.studioBlueprint._id))
			expectNotLoggedIn(async () => OrganizationContentWriteAccess.snapshot(nothing, snapshotId))
			expectNotLoggedIn(async () => OrganizationContentWriteAccess.dataFromSnapshot(nothing, org0._id))
			expectNotLoggedIn(async () => OrganizationContentWriteAccess.showStyleBase(nothing, env.showStyleBaseId))
			expectNotLoggedIn(async () => OrganizationContentWriteAccess.translationBundle(nothing, selectorOrg))

			// Normal user:
			expectAllowed(async () => OrganizationContentWriteAccess.organization(creator, org0._id))
			expectAllowed(async () => OrganizationContentWriteAccess.studio(creator, env.studio))
			expectAllowed(async () => OrganizationContentWriteAccess.evaluation(creator))
			expectAllowed(async () => OrganizationContentWriteAccess.mediaWorkFlows(creator))
			expectAllowed(async () => OrganizationContentWriteAccess.blueprint(creator, env.studioBlueprint._id))
			expectAllowed(async () => OrganizationContentWriteAccess.snapshot(creator, snapshotId))
			expectAllowed(async () => OrganizationContentWriteAccess.dataFromSnapshot(creator, org0._id))
			expectAllowed(async () => OrganizationContentWriteAccess.showStyleBase(creator, env.showStyleBaseId))
			expectAllowed(async () => OrganizationContentWriteAccess.translationBundle(creator, selectorOrg))
			// Other normal user:
			expectAllowed(async () => OrganizationContentWriteAccess.organization(userB, org0._id))
			expectAllowed(async () => OrganizationContentWriteAccess.studio(userB, env.studio))
			expectAllowed(async () => OrganizationContentWriteAccess.evaluation(userB))
			expectAllowed(async () => OrganizationContentWriteAccess.mediaWorkFlows(userB))
			expectAllowed(async () => OrganizationContentWriteAccess.blueprint(userB, env.studioBlueprint._id))
			expectAllowed(async () => OrganizationContentWriteAccess.snapshot(userB, snapshotId))
			expectAllowed(async () => OrganizationContentWriteAccess.dataFromSnapshot(userB, org0._id))
			expectAllowed(async () => OrganizationContentWriteAccess.showStyleBase(userB, env.showStyleBaseId))
			expectAllowed(async () => OrganizationContentWriteAccess.translationBundle(userB, selectorOrg))
			// Non-existing user:
			expectNotLoggedIn(async () => OrganizationContentWriteAccess.organization(nonExisting, org0._id))
			expectNotLoggedIn(async () => OrganizationContentWriteAccess.studio(nonExisting, env.studio))
			expectNotLoggedIn(async () => OrganizationContentWriteAccess.evaluation(nonExisting))
			expectNotLoggedIn(async () => OrganizationContentWriteAccess.mediaWorkFlows(nonExisting))
			expectNotLoggedIn(async () =>
				OrganizationContentWriteAccess.blueprint(nonExisting, env.studioBlueprint._id)
			)
			expectNotLoggedIn(async () => OrganizationContentWriteAccess.snapshot(nonExisting, snapshotId))
			expectNotLoggedIn(async () => OrganizationContentWriteAccess.dataFromSnapshot(nonExisting, org0._id))
			expectNotLoggedIn(async () =>
				OrganizationContentWriteAccess.showStyleBase(nonExisting, env.showStyleBaseId)
			)
			expectNotLoggedIn(async () => OrganizationContentWriteAccess.translationBundle(nonExisting, selectorOrg))
			// User in wrong organization:
			expectNotAllowed(async () => OrganizationContentWriteAccess.organization(wrongOrg, org0._id))
			expectNotAllowed(async () => OrganizationContentWriteAccess.studio(wrongOrg, env.studio))
			// expectNotAllowed(async() => OrganizationContentWriteAccess.evaluation(wrongOrg))
			// expectNotAllowed(async() => OrganizationContentWriteAccess.mediaWorkFlows(wrongOrg))
			expectNotAllowed(async () => OrganizationContentWriteAccess.blueprint(wrongOrg, env.studioBlueprint._id))
			expectNotAllowed(async () => OrganizationContentWriteAccess.snapshot(wrongOrg, snapshotId))
			expectNotAllowed(async () => OrganizationContentWriteAccess.dataFromSnapshot(wrongOrg, org0._id))
			expectNotAllowed(async () => OrganizationContentWriteAccess.showStyleBase(wrongOrg, env.showStyleBaseId))
			expectNotAllowed(async () => OrganizationContentWriteAccess.translationBundle(wrongOrg, selectorOrg))

			// Other SuperAdmin
			expectNotAllowed(async () => OrganizationContentWriteAccess.organization(otherSuperAdmin, org0._id))
			expectNotAllowed(async () => OrganizationContentWriteAccess.studio(otherSuperAdmin, env.studio))
			// expectNotAllowed(async() => OrganizationContentWriteAccess.evaluation(otherSuperAdmin))
			// expectNotAllowed(async() => OrganizationContentWriteAccess.mediaWorkFlows(otherSuperAdmin))
			expectNotAllowed(async () =>
				OrganizationContentWriteAccess.blueprint(otherSuperAdmin, env.studioBlueprint._id)
			)
			expectNotAllowed(async () => OrganizationContentWriteAccess.snapshot(otherSuperAdmin, snapshotId))
			expectNotAllowed(async () => OrganizationContentWriteAccess.dataFromSnapshot(otherSuperAdmin, org0._id))
			expectNotAllowed(async () =>
				OrganizationContentWriteAccess.showStyleBase(otherSuperAdmin, env.showStyleBaseId)
			)
			expectNotAllowed(async () => OrganizationContentWriteAccess.translationBundle(otherSuperAdmin, selectorOrg))
		})
	})
})

import * as _ from 'underscore'
import { TransformedCollection } from '../typings/meteor'
import { registerCollection, ProtectedString } from '../lib'
import { createMongoCollection } from './lib'
import { UserId } from './Users'

/** A string, identifying a Organization */
export type OrganizationId = ProtectedString<'OrganizationId'>

/** An organization is the entity that owns data (studios, rundowns, etc..) in Sofie */
export interface DBOrganization {
	_id: OrganizationId
	/** Name of the organization  */
	name: string

	admins: UserAdmin[]

	notes?: string

	created: number
	modified: number
}
export interface UserAdmin {
	userId: UserId
	// permissions: // add later
}
export type Organization = DBOrganization // to be replaced by a class some time later?

export const Organizations: TransformedCollection<Organization, DBOrganization>
	= createMongoCollection<DBOrganization>('organizations')
registerCollection('Organizations', Organizations)

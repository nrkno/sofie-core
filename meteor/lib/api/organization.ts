import { OrganizationId, NewOrganization } from '../../lib/collections/Organization'
import { UserId } from '../collections/Users'

export interface NewOrganizationAPI {
	insertOrganization(userId: UserId, organization: NewOrganization): Promise<OrganizationId>
	removeOrganization(): Promise<void>
}

export enum OrganizationAPIMethods {
	'insertOrganization' = 'organization.insertOrganization',
	'removeOrganization' = 'organization.removeOrganization',
}

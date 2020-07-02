import { OrganizationId } from '../../lib/collections/Organization'
import { UserId } from '../collections/Users'

export interface NewOrganizationAPI {
	removeOrganization(organizationId: OrganizationId): Promise<void>
}

export enum OrganizationAPIMethods {
	'removeOrganization' = 'organization.removeOrganization',
}

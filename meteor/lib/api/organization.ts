import { OrganizationId, NewOrganization } from '../../lib/collections/Organization'
export interface NewOrganizationAPI {
	insertOrganization (organization: NewOrganization): Promise<OrganizationId>
	removeOrganization (organizationId: OrganizationId): Promise<void>
}

export enum OrganizationAPIMethods {
	'insertOrganization' = 'organization.insertOrganization',
	'removeOrganization' = 'organization.removeOrganization',
}
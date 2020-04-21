import { OrganizationId } from '../../lib/collections/Organization'


export interface NewOrganizationAPI {
	insertOrganization (name: string): Promise<OrganizationId>
	removeOrganization (organizationId: OrganizationId): Promise<void>
}

export enum OrganizationAPIMethods {
	'insertOrganization' = 'organization.insertOrganization',
	'removeOrganization' = 'organization.removeOrganization',
}
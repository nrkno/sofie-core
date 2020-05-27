import { OrganizationId, NewOrganization } from '../../lib/collections/Organization'

export interface NewOrganizationAPI {
	insertOrganization (organization: NewOrganization): Promise<OrganizationId>
	removeOrganization (): Promise<void>
}

export enum OrganizationAPIMethods {
	'insertOrganization' = 'organization.insertOrganization',
	'removeOrganization' = 'organization.removeOrganization',
}

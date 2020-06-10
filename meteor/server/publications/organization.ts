import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { meteorPublish, AutoFillSelector } from './lib'
import { PubSub } from '../../lib/api/pubsub'
import { Blueprints, Blueprint } from '../../lib/collections/Blueprints'
import { Evaluations } from '../../lib/collections/Evaluations'
import { Snapshots } from '../../lib/collections/Snapshots'
import { UserActionsLog } from '../../lib/collections/UserActionsLog'
import { OrganizationReadAccess } from '../security/organization'
import { FindOptions } from '../../lib/typings/meteor'
import { Organizations } from '../../lib/collections/Organization'

meteorPublish(PubSub.organization, function(selector0, token) {
	const { cred, selector } = AutoFillSelector.organizationId(this.userId, selector0, token)
	const modifier: FindOptions<Blueprint> = {
		fields: {
			code: 0,
		},
	}
	if (OrganizationReadAccess.organizationContent(selector, cred)) {
		return Organizations.find(
			{ _id: selector.organizationId },
			{
				fields: {
					name: 1,
					applications: 1,
					broadcastMediums: 1,
				},
			}
		)
	}
	return null
})

meteorPublish(PubSub.blueprints, function(selector0, token) {
	const { cred, selector } = AutoFillSelector.organizationId(this.userId, selector0, token)
	const modifier: FindOptions<Blueprint> = {
		fields: {
			code: 0,
		},
	}
	if (OrganizationReadAccess.organizationContent(selector, cred)) {
		return Blueprints.find(selector, modifier)
	}
	return null
})
meteorPublish(PubSub.evaluations, function(selector0, token) {
	const { cred, selector } = AutoFillSelector.organizationId(this.userId, selector0, token)
	if (OrganizationReadAccess.organizationContent(selector, cred)) {
		return Evaluations.find(selector)
	}
	return null
})
meteorPublish(PubSub.snapshots, function(selector0, token) {
	const { cred, selector } = AutoFillSelector.organizationId(this.userId, selector0, token)
	if (OrganizationReadAccess.organizationContent(selector, cred)) {
		return Snapshots.find(selector)
	}
	return null
})
meteorPublish(PubSub.userActionsLog, function(selector0, token) {
	const { cred, selector } = AutoFillSelector.organizationId(this.userId, selector0, token)
	if (OrganizationReadAccess.organizationContent(selector, cred)) {
		return UserActionsLog.find(selector)
	}
	return null
})

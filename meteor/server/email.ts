import { Accounts } from 'meteor/accounts-base'
import { Meteor } from 'meteor/meteor'

Meteor.startup(function() {
	process.env.MAIL_URL = Meteor.settings.MAIL_URL
	Accounts.urls.verifyEmail = function(token) {
		return Meteor.absoluteUrl('login/verify-email/' + token)
	}
	Accounts.urls.resetPassword = function(token) {
		return Meteor.absoluteUrl('reset/' + token)
	}
})

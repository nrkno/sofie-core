import * as chai from 'chai'
import { } from 'mocha'
import { Meteor } from 'meteor/meteor'

import { getCurrentTime } from '../../lib/lib'

const expect = chai.expect

describe('getCurrentTime', function () {
	it('check that getCurrentTime returns the same value in the Client and in the Server', function (done) {
		Meteor.call('debug__printTime', (err, res) => {
			if (err) {
				done()
			}
			expect(res).to.equal(getCurrentTime())
		})
	})
})

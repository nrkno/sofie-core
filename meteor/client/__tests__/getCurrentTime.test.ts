import { Meteor } from 'meteor/meteor'

import { getCurrentTime } from '../../lib/lib'

describe('getCurrentTime', function () {
	test('check that getCurrentTime returns the same value in the Client and in the Server', function (done) {
		Meteor.call('debug__printTime', (err, res) => {
			if (err) {
				done()
			}
			expect(res).to.equal(getCurrentTime())
		})
	})
})

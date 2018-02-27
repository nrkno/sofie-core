
//import { chai } from 'chai';

var chai = require('chai');




describe('my module', function () {
  it('does something that should be tested', function () {
    // This code will be executed by the test driver when the app is started
    // in the correct mode
    //console.log('chai',chai);
    chai.assert.equal([1,2,3].indexOf(4), -1);
  })
})

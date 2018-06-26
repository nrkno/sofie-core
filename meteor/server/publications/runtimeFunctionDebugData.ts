import { Meteor } from 'meteor/meteor'
import { RuntimeFunctionDebugData } from '../../lib/collections/RuntimeFunctionDebugData'

Meteor.publish('runtimeFunctionDebugData', function (selector) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			data: 0
		}
	}
	return RuntimeFunctionDebugData.find(selector, modifier)
	// return this.ready()
})
Meteor.publish('runtimeFunctionDebugDataData', function (documentId: string) {
	return RuntimeFunctionDebugData.find({
		_id: documentId
	})
	// return this.ready()
})

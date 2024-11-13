import { Meteor } from 'meteor/meteor'
import { MakeMeteorCall } from '@sofie-automation/meteor-lib/dist/api/methods'

export const MeteorCall = MakeMeteorCall(MeteorPromiseApply)

/**
 * Convenience method to convert a Meteor.apply() into a Promise
 * @param callName {string} Method name
 * @param args {Array<any>} An array of arguments for the method call
 * @param options (Optional) An object with options for the call. See Meteor documentation.
 * @returns {Promise<any>} A promise containing the result of the called method.
 */
export async function MeteorPromiseApply(
	callName: Parameters<typeof Meteor.apply>[0],
	args: Parameters<typeof Meteor.apply>[1],
	options?: Parameters<typeof Meteor.apply>[2]
): Promise<any> {
	return new Promise((resolve, reject) => {
		Meteor.apply(callName, args, options, (err, res) => {
			if (err) reject(err)
			else resolve(res)
		})
	})
}

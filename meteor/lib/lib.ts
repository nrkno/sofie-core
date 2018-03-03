import { Meteor } from "meteor/meteor";


/**
 * Convenience method to convert a Meteor.call() into a Promise
 * @param  {string} Method name
 * @return {Promise<any>}
 */
export function MeteorPromiseCall(callName:string, ...any ):Promise<any> {

	return new Promise((resolve, reject) => {

		var args:Array<any> = [];
		for (let i = 1; i<arguments.length; i++ ) {
			args.push(arguments[i]);
		}

		Meteor.call(callName, ...args, (err, res) => {
			if (err) reject(err);
			else resolve(res);
		});

	});

}

export type Time = number;

/**
 * Returns the current (synced) time
 * @return {Time}
 */
export function getCurrentTime():Time {
	// TODO: Implement time sync feature
	// Just return the system time for now:
	return Date.now();
}
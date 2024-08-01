import { Meteor } from 'meteor/meteor'
import { UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export interface MethodContext extends Omit<Meteor.MethodThisType, 'userId'> {
	userId: UserId | null
}

/** Abstarct class to be used when defining Mehod-classes */
export abstract class MethodContextAPI implements MethodContext {
	// These properties are added by Meteor to the `this` context when calling methods
	public userId!: UserId | null
	public isSimulation!: boolean
	public setUserId(_userId: string | null): void {
		throw new Meteor.Error(
			500,
			`This shoulc never be called, there's something wrong in with 'this' in the calling method`
		)
	}
	public unblock(): void {
		throw new Meteor.Error(
			500,
			`This shoulc never be called, there's something wrong in with 'this' in the calling method`
		)
	}
	public connection!: Meteor.Connection | null
}

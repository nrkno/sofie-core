/**
 * Async version of Meteor.LiveQueryHandle
 */
export interface LiveQueryHandle {
	stop(): void | Promise<void>
}

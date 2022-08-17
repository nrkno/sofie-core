import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { MongoCursor } from './collections/lib'
import { PartInstance, PartInstances } from './collections/PartInstances'
import { Rundown, Rundowns } from './collections/Rundowns'
import { ShowStyleBase } from './collections/ShowStyleBases'
import { DBTriggeredActions } from './collections/TriggeredActions'

observerChain()
	.next('activePartInstance', () => PartInstances.find())
	.next('currentRundown', (state) =>
		state.activePartInstance ? Rundowns.find({ rundownId: state.activePartInstance.rundownId }) : null
	)
	.end((state) => {
		console.log(state)
	})

type Link<T extends object, K> = {
	next: NextFunction<T, string, K>
	end: (complete: (state: T) => void) => Meteor.LiveQueryHandle
}
type NextFunction<T extends { [key: string]: any }, L extends string, K extends { _id: ProtectedString<any> }> = (
	key: L,
	cursorChain: (state: Partial<T>) => MongoCursor<K> | null
) => Link<T & Record<L, K>, {}>

export function observerChain(): {
	next: NextFunction<{}, string>
} {
	// const handle = cursor.observe({
	// 	added: (obj: T) => then(obj),
	// 	changed: (obj: T) => then(obj),
	// 	removed: () => then(null),
	// })
	return {
		next: (fnc) => {},
	}
}

/* 
observerChain<{
	activePartInstance: PartInstance
	currentRundown: Rundown
	currentShowStyleBase: ShowStyleBase
	triggeredActions: DBTriggeredActions
}>()
	.next('activePartInstance', () => PartInstances.find())
	.next('currentRundown', (state) =>
		state.activePartInstance ? Rundowns.find({ rundownId: state.activePartInstance.rundownId }) : null
	)
	.end((state) => {
		console.log(state)
	})

type Link<T extends object> = {
	next: NextFunction<T, keyof T>
	end: (complete: (state: T) => void) => Meteor.LiveQueryHandle
}
type NextFunction<T extends { [key: string]: any }, L extends keyof T> = (
	key: L,
	cursorChain: (state: Partial<T>) => MongoCursor<T[L]> | null
) => Link<T>

export function observerChain<T extends object>(): {
	next: NextFunction<T, keyof T>
} {
	// const handle = cursor.observe({
	// 	added: (obj: T) => then(obj),
	// 	changed: (obj: T) => then(obj),
	// 	removed: () => then(null),
	// })
	return {
		next: (fnc) => {},
	}
}
*/

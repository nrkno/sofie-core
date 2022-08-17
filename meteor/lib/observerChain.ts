import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { MongoCursor } from './collections/lib'
import { Simplify } from 'type-fest'
import { PartInstances } from './collections/PartInstances'
import { Rundowns } from './collections/Rundowns'
import { RundownPlaylists } from './collections/RundownPlaylists'

observerChain()
	.next('activePlaylist', () => RundownPlaylists.find({ activationId: { $exists: true } }))
	.next('activePartInstance', (chain) => {
		const activePartInstanceId =
			chain.activePlaylist.currentPartInstanceId ?? chain.activePlaylist.nextPartInstanceId
		if (!activePartInstanceId) return null
		return PartInstances.find({ _id: activePartInstanceId })
	})
	.next('currentRundown', (chain) =>
		chain.activePartInstance ? Rundowns.find({ rundownId: chain.activePartInstance.rundownId }) : null
	)
	.end((state) => {
		console.log(state)
	})

/**
 * https://stackoverflow.com/a/66011942
 */
type StringLiteral<T> = T extends `${string & T}` ? T : never

/**
 * https://github.com/sindresorhus/type-fest/issues/417#issuecomment-1178753251
 */
type Not<Yes, Not> = Yes extends Not ? never : Yes

type Link<T> = {
	next: <L extends string, K extends { _id: ProtectedString<any> }>(
		key: Not<L, keyof T>,
		cursorChain: (state: T) => MongoCursor<K> | null
	) => Link<Simplify<T & { [P in StringLiteral<L>]: K }>>

	end: (complete: (state: T) => void) => Meteor.LiveQueryHandle
}

export function observerChain(): {
	next: <L extends string, K extends { _id: ProtectedString<any> }>(
		key: L,
		cursorChain: () => MongoCursor<K> | null
	) => Link<{ [P in StringLiteral<L>]: K }>
} {
	// const handle = cursor.observe({
	//  added: (obj: T) => then(obj),
	//  changed: (obj: T) => then(obj),
	//  removed: () => then(null),
	// })

	const collectorObject: Record<string, any> = {}

	let handle: Meteor.LiveQueryHandle

	return {
		next: (key, cursorChain) => {
			const cursor = cursorChain()
			if (!cursor) {
				throw new Error('Undefined behavior')
			}
			handle = cursor.observe({
				added: (obj) => {
					collectorObject[key] = obj
					// call next link
					throw new Error('Undefined behavior')
				},
				changed: (obj) => {
					collectorObject[key] = obj
					// call next link
					throw new Error('Undefined behavior')
				},
				removed: () => {
					delete collectorObject[key]
					// tear down subsequent chain
					throw new Error('Undefined behavior')
				},
			})

			// return a next/end object
			throw new Error('Undefined behavior')
		},
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

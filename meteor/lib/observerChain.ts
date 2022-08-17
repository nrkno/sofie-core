import { ProtectedString } from '@sofie-automation/corelib/dist/protectedString'
import { Meteor } from 'meteor/meteor'
import { MongoCursor } from './collections/lib'
import { Simplify } from 'type-fest'
import { DBPartInstance, PartInstances } from './collections/PartInstances'
import { DBRundown, Rundowns } from './collections/Rundowns'
import { RundownPlaylists } from './collections/RundownPlaylists'
import { assertNever } from './lib'
import { DBShowStyleBase, ShowStyleBases } from './collections/ShowStyleBases'
import { TriggeredActions } from './collections/TriggeredActions'

observerChain()
	.next('activePlaylist', () => RundownPlaylists.find({ activationId: { $exists: true } }))
	.next('activePartInstance', (chain) => {
		const activePartInstanceId =
			chain.activePlaylist.currentPartInstanceId ?? chain.activePlaylist.nextPartInstanceId
		if (!activePartInstanceId) return null
		return PartInstances.find({ _id: activePartInstanceId }, { fields: { rundownId: 1 }, limit: 1 }) as MongoCursor<
			Pick<DBPartInstance, '_id' | 'rundownId'>
		>
	})
	.next('currentRundown', (chain) =>
		chain.activePartInstance
			? (Rundowns.find(
					{ rundownId: chain.activePartInstance.rundownId },
					{ fields: { showStyleBaseId: 1 }, limit: 1 }
			  ) as MongoCursor<Pick<DBRundown, '_id' | 'showStyleBaseId'>>)
			: null
	)
	.next('showStyleBase', (chain) =>
		chain.currentRundown
			? (ShowStyleBases.find(
					{ _id: chain.currentRundown.showStyleBaseId },
					{ fields: { sourceLayers: 1, outputLayers: 1, hotkeyLegend: 1 }, limit: 1 }
			  ) as MongoCursor<Pick<DBShowStyleBase, '_id' | 'sourceLayers' | 'outputLayers' | 'hotkeyLegend'>>)
			: null
	)
	.next('triggeredActions', (chain) =>
		TriggeredActions.find({
			$or: [
				{
					showStyleBaseId: chain.showStyleBase._id,
				},
				{
					showStyleBaseId: null,
				},
			],
		})
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

	end: (complete: (state: T | null) => void) => Meteor.LiveQueryHandle
}

export function observerChain(): {
	next: <L extends string, K extends { _id: ProtectedString<any> }>(
		key: L,
		cursorChain: () => MongoCursor<K> | null
	) => Link<{ [P in StringLiteral<L>]: K }>
} {
	function createNextLink(collectorObject: Record<string, any>, liveQueryHandle: Meteor.LiveQueryHandle) {
		let mode: 'next' | 'end' | undefined
		let chainedCursor: (state: Record<string, any>) => MongoCursor<any> | null
		let completeFunction: (state: Record<string, any> | null) => void
		let chainedKey: string | undefined = undefined
		let previousObserver: Meteor.LiveQueryHandle | null = null
		const isStopped = false

		let nextChanged: (obj) => void = () => {
			if (mode === 'end') return
			throw new Error('Unfinished observer chain. This is a memory leak.')
		}
		let nextStop: () => void = () => {
			if (mode === 'end') return
			throw new Error('Unfinished observer chain. This is a memory leak.')
		}

		function changedLink(obj) {
			if (previousObserver) {
				previousObserver.stop()
				previousObserver = null
			}
			const cursorResult = chainedCursor(obj)
			if (cursorResult === null) {
				nextStop()
				return
			}

			previousObserver = cursorResult.observe({
				added: (doc) => {
					if (!chainedKey) throw new Error('Chained key needs to be defined')
					const newCollectorObject = {
						...collectorObject,
						chainedKey: doc,
					}
					nextStop()
					nextChanged(newCollectorObject)
				},
				changed: (doc) => {
					if (!chainedKey) throw new Error('Chained key needs to be defined')
					const newCollectorObject = {
						...collectorObject,
						chainedKey: doc,
					}
					nextStop()
					nextChanged(newCollectorObject)
				},
				removed: () => {
					if (!chainedKey) throw new Error('Chained key needs to be defined')
					nextStop()
				},
			})

			if (isStopped) {
				previousObserver.stop()
			}
		}

		function changedEnd(obj) {
			completeFunction(obj)
		}

		function stopLink() {
			if (previousObserver) {
				previousObserver.stop()
				previousObserver = null
			}

			nextStop()
		}

		function stopEnd() {
			completeFunction(null)
		}

		return {
			changed: (obj) => {
				switch (mode) {
					case 'next':
						changedLink(obj)
						break
					case 'end':
						changedEnd(obj)
						break
					case undefined:
						throw new Error('Unfinished observer chain. This is a memory leak.')
					default:
						assertNever(mode)
				}
			},
			stop: () => {
				switch (mode) {
					case 'next':
						stopLink()
						break
					case 'end':
						stopEnd()
						break
					case undefined:
						console.error('Unfinished observer chain. This is a memory leak.')
						break
					default:
						assertNever(mode)
				}
			},
			link: {
				next: (key: string, thisCursor) => {
					if (mode !== undefined) throw new Error('Cannot redefine chain after setup')
					if (!key) throw new Error('Key needs to be a defined, non-empty string')
					chainedKey = key
					chainedCursor = thisCursor
					mode = 'next'
					const { changed, stop, link } = createNextLink(collectorObject, liveQueryHandle)
					nextChanged = changed
					nextStop = stop
					return link
				},
				end: (complete) => {
					if (mode !== undefined) throw new Error('Cannot redefine chain after setup')
					mode = 'end'
					completeFunction = complete
					return liveQueryHandle
				},
			},
		}
	}

	const initialStopObject = {
		stop: () => {},
	}

	const { changed, stop, link } = createNextLink({}, initialStopObject)
	initialStopObject.stop = stop

	return {
		next: (key, cursorChain) => {
			const nextLink = link.next(key, cursorChain)
			changed({})
			return nextLink
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

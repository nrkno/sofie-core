import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import _ from 'underscore'
import { clone, ProtectedString } from '../../../lib/lib'
import { TriggerUpdate, setUpOptimizedObserverInner } from './optimizedObserverBase'
import { CustomPublish, CustomPublishChanges } from './publish'

export async function setUpOptimizedObserver<
	PublicationDoc extends { _id: ProtectedString<any> },
	Args,
	State extends Record<string, any>,
	UpdateProps extends Record<string, any>
>(
	identifier: string,
	args0: ReadonlyDeep<Args>,
	setupObservers: (
		args: ReadonlyDeep<Args>,
		/** Trigger an update by mutating the context of manipulateData */
		triggerUpdate: TriggerUpdate<UpdateProps>
	) => Promise<Meteor.LiveQueryHandle[]>,
	manipulateData: (
		args: ReadonlyDeep<Args>,
		state: Partial<State>,
		newProps: ReadonlyDeep<Partial<UpdateProps> | undefined>
	) => Promise<PublicationDoc[] | null>,
	receiver: CustomPublish<PublicationDoc>,
	lazynessDuration: number = 3 // ms
): Promise<void> {
	const converter = new OptimisedObserverGenericArray<PublicationDoc>()
	return setUpOptimizedObserverInner<PublicationDoc, Args, State, UpdateProps>(
		identifier,
		args0,
		setupObservers,
		async (args, state, newProps) => {
			const newDocs = await manipulateData(args, state, newProps)
			if (newDocs) {
				const changes = converter.updatedDocs(newDocs)
				return [newDocs, changes]
			} else {
				const changes: CustomPublishChanges<PublicationDoc> = {
					added: [],
					changed: [],
					removed: [],
				}
				return [converter.getDocs(), changes]
			}
		},
		receiver,
		lazynessDuration
	)
}

class OptimisedObserverGenericArray<DBObj extends { _id: ProtectedString<any> }> {
	#docs = new Map<DBObj['_id'], DBObj>()
	// #firstRun: boolean = true

	// public get isFirstRun(): boolean {
	// 	return this.#firstRun
	// }

	getDocs(): DBObj[] {
		return Array.from(this.#docs.values())
	}

	updatedDocs(newDocs: DBObj[]): CustomPublishChanges<DBObj> {
		const changes: CustomPublishChanges<DBObj> = {
			added: [],
			changed: [],
			removed: [],
		}

		const newIds = new Set<DBObj['_id']>()
		// figure out which documents have changed

		const oldIds = Array.from(this.#docs.keys())

		for (const newDoc0 of newDocs) {
			const id = newDoc0._id
			if (newIds.has(id)) {
				throw new Meteor.Error(`Error in custom publication: _id "${id}" is not unique!`)
			}
			newIds.add(id)

			const oldDoc = this.#docs.get(id)
			if (!oldDoc) {
				const newDoc = clone(newDoc0)

				// added
				this.#docs.set(id, newDoc)
				changes.added.push(newDoc)
			} else if (!_.isEqual(oldDoc, newDoc0)) {
				const newDoc = clone(newDoc0)

				// changed
				changes.changed.push(newDoc)
				this.#docs.set(id, newDoc)
			}
		}

		for (const id of oldIds) {
			if (!newIds.has(id)) {
				// Removed
				this.#docs.delete(id)
				changes.removed.push(id)
			}
		}

		// if (this.#firstRun) {
		// 	this.#firstRun = false
		// }

		return changes
	}
}

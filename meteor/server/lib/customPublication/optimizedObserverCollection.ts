import { Meteor } from 'meteor/meteor'
import { ReadonlyDeep } from 'type-fest'
import { ProtectedString } from '../../../lib/lib'
import { CustomPublishCollection } from './customPublishCollection'
import { TriggerUpdate, setUpOptimizedObserverInner } from './optimizedObserverBase'
import { CustomPublish } from './publish'

export async function setUpCollectionOptimizedObserver<
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
		collection: CustomPublishCollection<PublicationDoc>,
		newProps: ReadonlyDeep<Partial<UpdateProps> | undefined>
	) => Promise<void>,
	receiver: CustomPublish<PublicationDoc>,
	lazynessDuration: number = 3 // ms
): Promise<void> {
	const collection = new CustomPublishCollection<PublicationDoc>(identifier)
	return setUpOptimizedObserverInner<PublicationDoc, Args, State, UpdateProps>(
		identifier,
		args0,
		setupObservers,
		async (args, state, newProps) => {
			await manipulateData(args, state, collection, newProps)
			return collection.commitChanges()
		},
		receiver,
		lazynessDuration
	)
}

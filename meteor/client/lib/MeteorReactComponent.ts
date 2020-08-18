import { Tracker } from 'meteor/tracker'
import * as _ from 'underscore'
import * as React from 'react'
import { stringifyObjects } from '../../lib/lib'
import { Meteor } from 'meteor/meteor'
import { PubSub } from '../../lib/api/pubsub'
export class MeteorReactComponent<IProps, IState = {}> extends React.Component<IProps, IState> {
	private _subscriptions: { [id: string]: Meteor.SubscriptionHandle } = {}
	private _computations: Array<Tracker.Computation> = []
	constructor(props, context?: any) {
		super(props, context)
	}

	componentWillUnmount() {
		this._cleanUp()
	}
	subscribe(name: PubSub, ...args: any[]): Meteor.SubscriptionHandle {
		// @ts-ignore
		return Tracker.nonreactive(() => {
			// let id = name + '_' + JSON.stringify(args.join())
			let id = name + '_' + stringifyObjects(args)

			const callbacks = {
				onError: console.error,
			}
			if (Tracker.active) {
				// if in a reactive context, Meteor will keep track of duplicates of subscriptions

				let sub = Meteor.subscribe(name, ...args, callbacks)
				this._subscriptions[id] = sub
				return sub
			} else {
				if (this._subscriptions[id]) {
					// already subscribed to that
					return this._subscriptions[id]
				} else {
					let sub = Meteor.subscribe(name, ...args, callbacks)
					this._subscriptions[id] = sub
					return sub
				}
			}
		})
	}
	autorun(cb: (computation: Tracker.Computation) => void, options?: any): Tracker.Computation {
		let computation = Tracker.nonreactive(() => {
			return Tracker.autorun(cb, options)
		})
		this._computations.push(computation)
		return computation
	}
	subscriptionsReady(): boolean {
		for (let sub of Object.values(this._subscriptions)) {
			if (!sub.ready()) {
				return false
			}
		}
		return true
	}
	subscriptions(): Array<Meteor.SubscriptionHandle> {
		return Object.values(this._subscriptions)
	}
	protected _cleanUp() {
		for (let sub of Object.values(this._subscriptions)) {
			// Wait a little bit with unsubscribing, maybe the next view is going to subscribe to the same data as well?
			// In that case, by unsubscribing directly, we'll get a flicker in the view because of the unloading+loading
			Meteor.setTimeout(() => {
				sub.stop()
			}, 100)
		}
		for (let computation of Object.values(this._computations)) {
			computation.stop()
		}
	}
}

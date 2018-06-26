import { Tracker } from 'meteor/tracker'
import * as _ from 'underscore'
import * as React from 'react'

export class MeteorReactComponent<IProps, IState> extends React.Component<IProps, IState> {

	private _subscriptions: {[id: string]: Meteor.SubscriptionHandle} = {}
	private _computations: Array<Tracker.Computation> = []
	constructor (props) {
		super(props)
	}

	componentWillUnmount () {
		this._cleanUp()
	}
	protected subscribe (name: string, ...args: any[]) {

		let id = name + '_' + JSON.stringify(args.join())

		if (this._subscriptions[id]) {
			// already subscribed to that
			return this._subscriptions[id]
		} else {
			let sub = Meteor.subscribe(name, ...args)
			this._subscriptions[id] = sub
		}
	}
	protected _cleanUp () {
		_.each(this._subscriptions, (sub ) => {
			sub.stop()
		})
		_.each(this._computations, (computation ) => {
			computation.stop()
		})
	}
	protected autorun (cb: () => void, options?: any) {
		this._computations.push(Tracker.autorun(cb, options))
	}
}

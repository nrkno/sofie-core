import * as _ from 'underscore'
import * as React from 'react'
import { Meteor } from 'meteor/meteor'
import { PubSub } from '../../lib/api/pubsub'

export function multilineText (txt: string) {
	return _.map((txt + '').split('\n'), (line: string) => {
		return <p>{line}</p>
	})
}

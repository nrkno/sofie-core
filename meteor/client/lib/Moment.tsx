import * as React from 'react'
import Moment, { MomentProps } from 'react-moment'
import moment from 'moment'
import { getCurrentTime } from '../../lib/lib'
import * as _ from 'underscore'

/**
 * Use instead of <Moment fromNow></Moment>, its result is synced with getCurrentTime()
 * @param args same as for Moment
 */
export function MomentFromNow (args: MomentProps) {
	let o: MomentProps = _.extend({}, args, {
		from: moment(getCurrentTime())
	})
	return (
		<Moment {...o}></Moment>
	)
}

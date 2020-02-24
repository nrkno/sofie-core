import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { Bucket } from '../../../lib/collections/Buckets'
import { BucketPanel } from './BucketPanel'
import { Rundown } from '../../../lib/collections/Rundowns'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'

import * as faBars from '@fortawesome/fontawesome-free-solid/faBars'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

interface IBucketsProps {
	buckets: Bucket[] | undefined
	rundown: Rundown
	showStyleBase: ShowStyleBase
	shouldQueue: boolean
}

interface IState {

}

export class RundownViewBuckets extends React.Component<IBucketsProps, IState> {
	touchHandle = (e: React.TouchEvent<HTMLDivElement>) => {
		e.preventDefault()
	}

	grabHandle = (e: React.MouseEvent<HTMLDivElement>) => {
		e.preventDefault()
	}

	render () {
		const { rundown, buckets, showStyleBase, shouldQueue } = this.props
		return buckets && buckets.map(bucket => 
			<div className='rundown-view__shelf__contents__pane'
				key={bucket._id}
				style={{
					minWidth: ((bucket.width !== undefined ? bucket.width : 0.2) * 100) + 'vw'
				}}
			>
				<div className='rundown-view__shelf__contents__pane__divider'
					onMouseDown={this.grabHandle}
					onTouchStart={this.touchHandle}>
					<div className='rundown-view__shelf__contents__pane__handle'>
						<FontAwesomeIcon icon={faBars} />
					</div>
				</div>
				<BucketPanel
					rundown={rundown}
					showStyleBase={showStyleBase}
					shouldQueue={shouldQueue}
					bucket={bucket}
				/>
			</div>
		)
	}
}
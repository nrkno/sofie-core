import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import React from 'react'
import { withResolvedSegment } from '../../SegmentContainer/withResolvedSegment'
import { Part } from './Part'

export const Segment = withResolvedSegment(({ parts, segmentui }) => {
	return (
		<div className="camera-screen__segment">
			<div className="camera-screen__segment-name">{segmentui?.name}</div>
			{parts.map((part) => (
				<Part key={unprotectString(part.instance._id)} part={part}></Part>
			))}
		</div>
	)
})

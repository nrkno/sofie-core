import React, { useContext } from 'react'
import { useSubscription, useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { Rundown as RundownObj } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { PubSub } from '../../../../lib/api/pubsub'
import { Segments } from '../../../collections'
import { Segment } from '../../../../lib/collections/Segments'
import { Segment as SegmentComponent } from './Segment'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { UIShowStyleBases } from '../../Collections'
import { RundownToShowStyleContext, StudioContext } from '.'

export function Rundown({ playlist, rundown }: { playlist: RundownPlaylist; rundown: RundownObj }): JSX.Element | null {
	const rundownId = rundown._id

	useSubscription(PubSub.segments, {
		rundownId,
	})

	const segments = useTracker(() => Segments.find({ rundownId }).fetch(), [rundownId], [] as Segment[])

	useSubscription(PubSub.uiShowStyleBase, rundown.showStyleBaseId)

	const showStyleBase = useTracker(
		() => UIShowStyleBases.findOne(rundown.showStyleBaseId),
		[rundown.showStyleBaseId],
		undefined
	)

	useSubscription(PubSub.partInstancesSimple, {
		rundownId,
	})

	useSubscription(PubSub.parts, [rundownId])

	useSubscription(PubSub.pieceInstancesSimple, {
		rundownId,
	})

	useSubscription(PubSub.pieces, {
		startRundownId: rundownId,
	})

	const studio = useContext(StudioContext)

	if (!showStyleBase || !studio) return null

	return (
		<div className="camera-screen__rundown">
			{segments.map((segment) => (
				<RundownToShowStyleContext.Consumer key={unprotectString(segment._id)}>
					{(rundownToShowStyle) => (
						<SegmentComponent
							rundown={rundown}
							rundownId={rundownId}
							playlist={playlist}
							segmentId={segment._id}
							showStyleBase={showStyleBase}
							studio={studio}
							timeScale={1}
							studioMode={false}
							countdownToSegmentRequireLayers={undefined}
							fixedSegmentDuration={false}
							followLiveSegments={true}
							isFollowingOnAirSegment={true}
							isLastSegment={false} // TODO: fix
							miniShelfFilter={undefined}
							ownCurrentPartInstance={undefined}
							ownNextPartInstance={undefined}
							rundownViewLayout={undefined}
							rundownsToShowstyles={rundownToShowStyle}
							rundownIdsBefore={[]}
							segmentsIdsBefore={new Set()}
						/>
					)}
				</RundownToShowStyleContext.Consumer>
			))}
		</div>
	)
}

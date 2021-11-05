import React, { useEffect } from 'react'
import { Meteor } from 'meteor/meteor'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { PubSub } from '../../../lib/api/pubsub'
import { PartInstances } from '../../../lib/collections/PartInstances'
import { Parts } from '../../../lib/collections/Parts'
import { Segments } from '../../../lib/collections/Segments'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import {
	// PartUi,
	withResolvedSegment,
	IProps as IResolvedSegmentProps,
	// ITrackedProps as ITrackedResolvedSegmentProps,
} from '../SegmentContainer/withResolvedSegment'
import { SpeechSynthesiser } from '../../lib/speechSynthesis'

interface IProps extends IResolvedSegmentProps {
	id: string
}

export const SegmentStoryboardContainer = withResolvedSegment(function SegmentStoryboardContainer({
	rundownId,
	rundownIdsBefore,
	segmentId,
	segmentsIdsBefore,
}: IProps) {
	const partIds = useTracker(
		() =>
			Parts.find(
				{
					segmentId,
				},
				{
					fields: {
						_id: 1,
					},
				}
			).map((part) => part._id),
		[segmentId]
	)

	useSubscription(
		PubSub.pieces,
		{
			startRundownId: this.props.rundownId,
			startPartId: {
				$in: partIds,
			},
		},
		[partIds]
	)

	const partInstanceIds = useTracker(
		() =>
			PartInstances.find(
				{
					segmentId: segmentId,
					reset: {
						$ne: true,
					},
				},
				{
					fields: {
						_id: 1,
						part: 1,
					},
				}
			).map((instance) => instance._id),
		[segmentId]
	)

	useSubscription(
		PubSub.pieceInstances,
		{
			rundownId: rundownId,
			partInstanceId: {
				$in: partInstanceIds,
			},
			reset: {
				$ne: true,
			},
		},
		[rundownId, partInstanceIds]
	)

	useTracker(() => {
		const segment = Segments.findOne(segmentId, {
			fields: {
				rundownId: 1,
				_rank: 1,
			},
		})
		segment &&
			Meteor.subscribe(PubSub.pieces, {
				invalid: {
					$ne: true,
				},
				$or: [
					// same rundown, and previous segment
					{
						startRundownId: rundownId,
						startSegmentId: { $in: Array.from(segmentsIdsBefore.values()) },
						lifespan: {
							$in: [PieceLifespan.OutOnRundownEnd, PieceLifespan.OutOnRundownChange, PieceLifespan.OutOnShowStyleEnd],
						},
					},
					// Previous rundown
					{
						startRundownId: { $in: Array.from(rundownIdsBefore.values()) },
						lifespan: {
							$in: [PieceLifespan.OutOnShowStyleEnd],
						},
					},
				],
			})
	}, [segmentId, rundownId, segmentsIdsBefore.values(), rundownIdsBefore.values()])

	useEffect(() => {
		SpeechSynthesiser.init()

		// RundownViewEventBus.on(RundownViewEvents.REWIND_SEGMENTS, onRewindSegment)
		// RundownViewEventBus.on(RundownViewEvents.GO_TO_PART, onGoToPart)
		// RundownViewEventBus.on(RundownViewEvents.GO_TO_PART_INSTANCE, onGoToPartInstance)
	}, [])

	return <></>
})

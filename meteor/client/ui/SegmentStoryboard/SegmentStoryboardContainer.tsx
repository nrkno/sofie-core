import React, { useEffect, useState } from 'react'
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
	ITrackedProps as ITrackedResolvedSegmentProps,
} from '../SegmentContainer/withResolvedSegment'
import { SpeechSynthesiser } from '../../lib/speechSynthesis'
import { SegmentStoryboard } from './SegmentStoryboard'
import { unprotectString } from '../../../lib/lib'

interface IProps extends IResolvedSegmentProps {
	id: string
}

export const LIVELINE_HISTORY_SIZE = 1

export const SegmentStoryboardContainer = withResolvedSegment<IProps>(function SegmentStoryboardContainer({
	rundownId,
	rundownIdsBefore,
	segmentId,
	segmentsIdsBefore,
	...props
}: IProps & ITrackedResolvedSegmentProps) {
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
			startRundownId: rundownId,
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

	const [scrollLeft] = useState(0)
	const [livePosition] = useState(0)

	const isLiveSegment = useTracker(
		() => {
			if (!props.playlist.currentPartInstanceId || !props.playlist.activationId) {
				return false
			}

			const currentPartInstance = PartInstances.findOne(props.playlist.currentPartInstanceId)
			if (!currentPartInstance) {
				return false
			}

			return currentPartInstance.segmentId === segmentId
		},
		[segmentId, props.playlist.activationId, props.playlist.currentPartInstanceId],
		false
	)

	const isNextSegment = useTracker(
		() => {
			if (!props.playlist.nextPartInstanceId || !props.playlist.activationId) {
				return false
			}

			const partInstance = PartInstances.findOne(props.playlist.nextPartInstanceId, {
				fields: {
					//@ts-ignore
					segmentId: 1,
					'part._id': 1,
				},
			})
			if (!partInstance) {
				return false
			}

			return partInstance.segmentId === segmentId
		},
		[segmentId, props.playlist.activationId, props.playlist.nextPartInstanceId],
		false
	)

	const autoNextPart = useTracker(
		() => {
			if (!props.playlist.currentPartInstanceId || !props.playlist.activationId) {
				return false
			}

			const currentPartInstance = PartInstances.findOne(props.playlist.currentPartInstanceId, {
				fields: {
					//@ts-ignore
					'part.autoNext': 1,
					'part.expectedDuration': 1,
				},
			})
			if (!currentPartInstance) {
				return false
			}

			return !!(currentPartInstance.part.autoNext && currentPartInstance.part.expectedDuration)
		},
		[segmentId, props.playlist.activationId, props.playlist.currentPartInstanceId],
		false
	)

	useEffect(() => {
		SpeechSynthesiser.init()

		// RundownViewEventBus.on(RundownViewEvents.REWIND_SEGMENTS, onRewindSegment)
		// RundownViewEventBus.on(RundownViewEvents.GO_TO_PART, onGoToPart)
		// RundownViewEventBus.on(RundownViewEvents.GO_TO_PART_INSTANCE, onGoToPartInstance)
	}, [])

	const segmentRef = React.createRef<HTMLDivElement>()

	if (props.segmentui === undefined) {
		return null
	}

	return (
		<SegmentStoryboard
			id={props.id}
			ref={segmentRef}
			key={unprotectString(props.segmentui._id)}
			segment={props.segmentui}
			studio={props.studio}
			parts={props.parts}
			segmentNotes={props.segmentNotes}
			onItemClick={props.onPieceClick}
			onItemDoubleClick={props.onPieceDoubleClick}
			scrollLeft={scrollLeft}
			playlist={props.playlist}
			followLiveSegments={props.followLiveSegments}
			isLiveSegment={isLiveSegment}
			isNextSegment={isNextSegment}
			isQueuedSegment={props.playlist.nextSegmentId === props.segmentui._id}
			hasRemoteItems={props.hasRemoteItems}
			hasGuestItems={props.hasGuestItems}
			autoNextPart={autoNextPart}
			hasAlreadyPlayed={props.hasAlreadyPlayed}
			followLiveLine={props.followLiveSegments}
			liveLineHistorySize={LIVELINE_HISTORY_SIZE}
			livePosition={livePosition}
			displayLiveLineCounter={props.displayLiveLineCounter}
			onContextMenu={props.onContextMenu}
			onFollowLiveLine={this.onFollowLiveLine}
			onShowEntireSegment={this.onShowEntireSegment}
			onZoomChange={this.onZoomChange}
			onScroll={this.onScroll}
			isLastSegment={props.isLastSegment}
			lastValidPartIndex={props.lastValidPartIndex}
			onHeaderNoteClick={props.onHeaderNoteClick}
			budgetDuration={props.budgetDuration}
			showCountdownToSegment={props.showCountdownToSegment}
			fixedSegmentDuration={props.fixedSegmentDuration}
		/>
	)
})

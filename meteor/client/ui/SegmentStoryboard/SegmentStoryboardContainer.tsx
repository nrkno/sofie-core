import React, { useCallback, useEffect, useRef, useState } from 'react'
import { PieceLifespan } from '@sofie-automation/blueprints-integration'
import { meteorSubscribe, PubSub } from '../../../lib/api/pubsub'
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
import { LIVELINE_HISTORY_SIZE as TIMELINE_LIVELINE_HISTORY_SIZE } from '../SegmentTimeline/SegmentTimelineContainer'
import { PartInstances, Parts, Segments } from '../../collections'

export const LIVELINE_HISTORY_SIZE = TIMELINE_LIVELINE_HISTORY_SIZE

interface IProps extends IResolvedSegmentProps {
	id: string
}

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

	const piecesReady = useSubscription(PubSub.pieces, {
		startRundownId: rundownId,
		startPartId: {
			$in: partIds,
		},
	})

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

	const pieceInstancesReady = useSubscription(PubSub.pieceInstances, {
		rundownId: rundownId,
		partInstanceId: {
			$in: partInstanceIds,
		},
		reset: {
			$ne: true,
		},
	})

	useTracker(() => {
		const segment = Segments.findOne(segmentId, {
			fields: {
				rundownId: 1,
				_rank: 1,
			},
		})
		segment &&
			meteorSubscribe(PubSub.pieces, {
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
					//@ts-expect-error typescript doesnt like it
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

	const currentPartWillAutoNext = useTracker(
		() => {
			if (!props.playlist.currentPartInstanceId || !props.playlist.activationId) {
				return false
			}

			const currentPartInstance = PartInstances.findOne(props.playlist.currentPartInstanceId, {
				fields: {
					//@ts-expect-error deep property
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
	}, [])

	const segmentRef = useRef<HTMLDivElement | null>(null)

	const subscriptionsReady = piecesReady && pieceInstancesReady

	// We are only interested in when subscriptionsReady turns *true* the first time. It can turn false later
	// and then back to true (when re-subscribing, say when you re-next a Part), but we're not interested in those
	// cases and it's a "false" signal for us.
	const [initialSubscriptionsReady, setInitialSubscriptionsReady] = useState(subscriptionsReady)

	// The following set up is supposed to avoid a flash of "empty" parts while Pieces and PieceInstances are streaming in.
	// One could think that it would be enough to wait for "subscriptionsReady" to turn to *true*, but one would be wrong.
	// There _could_ be a short amount of time when the subscriptions are ready, but the trackers haven't
	// finished autorunning, and then `withResolvedSegment` needs some time to re-resolve the entire Segment.
	// In that window of time it is possible that `withResolvedSegment` will actually return a Segment with just
	// rundown-spanning infinites, therefore we need to filter them out as well.
	// Ultimately, it is possible that the `firstNonInvalidPart` is in fact empty, so we need to set up a Timeout
	// so that we show the Part as-is.
	const firstNonInvalidPart = props.parts.find((part) => !part.instance.part.invalid)
	useEffect(() => {
		if (subscriptionsReady === true) {
			if (
				firstNonInvalidPart?.pieces !== undefined &&
				firstNonInvalidPart?.pieces.filter((piece) => !piece.hasOriginInPreceedingPart).length > 0
			) {
				setInitialSubscriptionsReady(subscriptionsReady)
			} else {
				// we can't wait for the pieces to appear forever
				const timeout = setTimeout(() => {
					setInitialSubscriptionsReady(subscriptionsReady)
				}, 1000)

				return () => {
					clearTimeout(timeout)
				}
			}
		}
	}, [subscriptionsReady, firstNonInvalidPart?.pieces.length])

	const onScroll = useCallback(() => {
		if (isLiveSegment) {
			if (props.onSegmentScroll) props.onSegmentScroll()
		}
	}, [props.onSegmentScroll, isLiveSegment])

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
			segmentNoteCounts={props.segmentNoteCounts}
			onItemClick={props.onPieceClick}
			onItemDoubleClick={props.onPieceDoubleClick}
			playlist={props.playlist}
			isLiveSegment={isLiveSegment}
			isNextSegment={isNextSegment}
			isQueuedSegment={props.playlist.nextSegmentId === props.segmentui._id}
			hasRemoteItems={props.hasRemoteItems}
			hasGuestItems={props.hasGuestItems}
			currentPartWillAutoNext={currentPartWillAutoNext}
			hasAlreadyPlayed={props.hasAlreadyPlayed}
			followLiveLine={props.followLiveSegments}
			liveLineHistorySize={LIVELINE_HISTORY_SIZE}
			displayLiveLineCounter={props.displayLiveLineCounter}
			onContextMenu={props.onContextMenu}
			// onFollowLiveLine={this.onFollowLiveLine}
			// onShowEntireSegment={this.onShowEntireSegment}
			onScroll={onScroll}
			isLastSegment={props.isLastSegment}
			lastValidPartIndex={props.lastValidPartIndex}
			onHeaderNoteClick={props.onHeaderNoteClick}
			onSwitchViewMode={props.onSwitchViewMode}
			budgetDuration={props.budgetDuration}
			showCountdownToSegment={props.showCountdownToSegment}
			fixedSegmentDuration={props.fixedSegmentDuration}
			subscriptionsReady={initialSubscriptionsReady}
		/>
	)
})

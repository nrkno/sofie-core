import React from 'react'
import { useTranslation } from 'react-i18next'
import { ZoomInIcon, ZoomOutIcon, ZoomShowAll } from '../../lib/ui/icons/segmentZoomIcon'
import { Storyboard } from '../../lib/ui/icons/segment'
import { SegmentViewMode } from '../SegmentContainer/SegmentViewModes'

interface IProps {
	timeScale: number
	maxTimeScale: number
	isLiveSegment: boolean
	scrollLeft: number
	onScroll: (scrollLeft: number, e: React.MouseEvent<HTMLElement>) => void
	onShowEntireSegment?: (e: React.MouseEvent<HTMLElement>) => void
	onZoomChange: (zoomLevel: number, e: React.MouseEvent<HTMLElement>) => void
	onSwitchViewMode: (newViewMode: SegmentViewMode) => void
	onRecalculateMaxTimeScale: () => Promise<number>
}

export function SegmentTimelineZoomButtons(props: IProps) {
	const { t } = useTranslation()
	const zoomIn = (e: React.MouseEvent<HTMLElement>) => {
		props.onZoomChange(props.timeScale * 2, e)
	}

	const zoomOut = (e: React.MouseEvent<HTMLElement>) => {
		// if the segment is live, the maxTimeScale will not be recalculated while it's being played back, because
		// that would require layout trashing the page on every timing tick. Instead, we cause the maxTimeScale to
		// be recalculated manually, when the user actually interacts with the zoom
		if (props.isLiveSegment) {
			e.persist()
			props
				.onRecalculateMaxTimeScale()
				.then((maxTimeScale) => zoomOutInner(maxTimeScale, e))
				.catch(console.error)
		} else {
			zoomOutInner(props.maxTimeScale, e)
		}
	}

	const zoomOutInner = (maxTimeScale: number, e: React.MouseEvent<HTMLElement>) => {
		const targetTimeScale = Math.max(props.timeScale * 0.5, maxTimeScale)
		props.onZoomChange(targetTimeScale, e)
		if (targetTimeScale === maxTimeScale && !props.isLiveSegment) {
			props.onScroll(0, e)
		}
	}

	const zoomNormalize = (e: React.MouseEvent<HTMLElement>) => {
		props.onShowEntireSegment && props.onShowEntireSegment(e)
		if (!props.isLiveSegment && props.scrollLeft > 0) {
			props.onScroll(0, e)
		}
	}

	const switchViewMode = () => {
		props.onSwitchViewMode(SegmentViewMode.Storyboard)
	}

	return (
		<div className="segment-timeline__timeline-zoom-buttons">
			<button
				className="segment-timeline__timeline-zoom-buttons__button segment-timeline__timeline-zoom-buttons__button--switch-mode segment-timeline__timeline-zoom-buttons__button--switch-mode--storyboard"
				onClick={switchViewMode}
				title={t('Switch to Storyboard mode')}
			>
				<Storyboard />
			</button>
			<button
				className="segment-timeline__timeline-zoom-buttons__button segment-timeline__timeline-zoom-buttons__button--out"
				onClick={zoomOut}
				disabled={props.timeScale <= props.maxTimeScale && !props.isLiveSegment}
				title={t('Zoom Out')}
			>
				<ZoomOutIcon />
			</button>
			<button
				className="segment-timeline__timeline-zoom-buttons__button segment-timeline__timeline-zoom-buttons__button--all"
				onClick={zoomNormalize}
				title={t('Show All')}
			>
				<ZoomShowAll />
			</button>
			<button
				className="segment-timeline__timeline-zoom-buttons__button segment-timeline__timeline-zoom-buttons__button--in"
				onClick={zoomIn}
				title={t('Zoom In')}
			>
				<ZoomInIcon />
			</button>
		</div>
	)
}

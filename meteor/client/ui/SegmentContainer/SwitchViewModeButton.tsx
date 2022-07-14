import Tooltip from 'rc-tooltip'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { getUseOnePartPerLine } from '../../lib/localStorage'
import { TimelineView } from '../../lib/ui/icons/timelineView'
import { StoryboardView } from '../../lib/ui/icons/storyboardView'
import { ListView } from '../../lib/ui/icons/listView'

import { SegmentViewMode } from './SegmentViewModes'

function getNextMode(currentMode: SegmentViewMode): SegmentViewMode {
	switch (currentMode) {
		case SegmentViewMode.Timeline:
			return SegmentViewMode.Storyboard
		case SegmentViewMode.Storyboard:
			return getUseOnePartPerLine() ? SegmentViewMode.List : SegmentViewMode.Timeline
		case SegmentViewMode.List:
			return SegmentViewMode.Timeline
	}
}

export function SwitchViewModeButton({
	currentMode,
	onSwitchViewMode,
}: {
	currentMode: SegmentViewMode
	onSwitchViewMode?: (viewMode: SegmentViewMode) => void
}) {
	const { t } = useTranslation()

	const nextMode = getNextMode(currentMode)

	switch (nextMode) {
		case SegmentViewMode.Timeline:
			return (
				<Tooltip overlay={t('Switch to Timeline View')}>
					<button
						className="segment-timeline__switch-view-mode-button"
						onClick={() => onSwitchViewMode && onSwitchViewMode(nextMode)}
					>
						<TimelineView />
					</button>
				</Tooltip>
			)
		case SegmentViewMode.Storyboard:
			return (
				<Tooltip overlay={t('Switch to Storyboard View')}>
					<button
						className="segment-timeline__switch-view-mode-button"
						onClick={() => onSwitchViewMode && onSwitchViewMode(nextMode)}
					>
						<StoryboardView />
					</button>
				</Tooltip>
			)
		case SegmentViewMode.List:
			return (
				<Tooltip overlay={t('Switch to List View')}>
					<button
						className="segment-timeline__switch-view-mode-button"
						onClick={() => onSwitchViewMode && onSwitchViewMode(nextMode)}
					>
						<ListView />
					</button>
				</Tooltip>
			)
	}
}

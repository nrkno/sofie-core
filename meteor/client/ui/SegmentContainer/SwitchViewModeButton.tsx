import Tooltip from 'rc-tooltip'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { getUseOnePartPerLine } from '../../lib/localStorage'
import { Storyboard, Timeline, List } from '../../lib/ui/icons/segment'
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
				<Tooltip overlay={t('Switch to Timeline view')}>
					<button
						className="segment-timeline__switch-view-mode-button"
						onClick={() => onSwitchViewMode && onSwitchViewMode(nextMode)}
					>
						<Timeline />
					</button>
				</Tooltip>
			)
		case SegmentViewMode.Storyboard:
			return (
				<Tooltip overlay={t('Switch to Storyboard view')}>
					<button
						className="segment-timeline__switch-view-mode-button"
						onClick={() => onSwitchViewMode && onSwitchViewMode(nextMode)}
					>
						<Storyboard />
					</button>
				</Tooltip>
			)
		case SegmentViewMode.List:
			return (
				<Tooltip overlay={t('Switch to List view')}>
					<button
						className="segment-timeline__switch-view-mode-button"
						onClick={() => onSwitchViewMode && onSwitchViewMode(nextMode)}
					>
						<List />
					</button>
				</Tooltip>
			)
	}
}

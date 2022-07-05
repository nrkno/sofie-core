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
			return getUseOnePartPerLine() ? SegmentViewMode.OnePartPerLine : SegmentViewMode.Timeline
		case SegmentViewMode.OnePartPerLine:
			return SegmentViewMode.Timeline
	}
}

export function SwitchViewModeButton({
	currentMode,
	onSwitchViewMode,
}: {
	currentMode: SegmentViewMode
	onSwitchViewMode: (viewMode: SegmentViewMode) => void
}) {
	const { t } = useTranslation()

	const nextMode = getNextMode(currentMode)

	switch (nextMode) {
		case SegmentViewMode.Timeline:
			return (
				<button
					className="segment-timeline__switch-view-mode-button"
					onClick={() => onSwitchViewMode(nextMode)}
					title={t('Switch to Timeline view')}
				>
					<Timeline />
				</button>
			)
		case SegmentViewMode.Storyboard:
			return (
				<button
					className="segment-timeline__switch-view-mode-button"
					onClick={() => onSwitchViewMode(nextMode)}
					title={t('Switch to Storyboard view')}
				>
					<Storyboard />
				</button>
			)
		case SegmentViewMode.OnePartPerLine:
			return (
				<button
					className="segment-timeline__switch-view-mode-button"
					onClick={() => onSwitchViewMode(nextMode)}
					title={t('Switch to List view')}
				>
					<List />
				</button>
			)
	}
}

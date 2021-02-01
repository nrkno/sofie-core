import classNames from 'classnames'
import React from 'react'
import { withTranslation } from 'react-i18next'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'

export interface IPlaylistRankMethodToggleProps {
	manualSortingActive: boolean
	toggleCallbackHandler: () => void
}

export default withTranslation()(function PlaylistRankMethodToggle(props: Translated<IPlaylistRankMethodToggleProps>) {
	const { t } = props

	const ncsSortingLabelClassnames = classNames('rundown-playlist__sorting-origin-toggle--label', {
		active: props.manualSortingActive !== true,
	})
	const ncsSortingLabelText = props.manualSortingActive === true ? t('Use ENPS order') : t('Using ENPS order')

	const switchButtonClassname = classNames('switch-button', 'sb-nocolor', {
		'sb-on': props.manualSortingActive,
	})

	const sofieSortingLabelClassnames = classNames('rundown-playlist__sorting-origin-toggle--label', {
		active: props.manualSortingActive === true,
	})
	const sofieSortingLabelText =
		props.manualSortingActive === true ? t('Using local Sofie order') : t('Change order in playlist to override')

	return (
		<span className="rundown-playlist__sorting-origin-toggle">
			<span className={ncsSortingLabelClassnames}>{ncsSortingLabelText}</span>
			<a className={switchButtonClassname} role="button" onClick={() => props.toggleCallbackHandler()} tabIndex={0}>
				<div className="sb-content">
					<div className="sb-label">
						<span className="mls">&nbsp;</span>
						<span className="mrs right">&nbsp;</span>
					</div>
					<div className="sb-switch"></div>
				</div>
			</a>
			<span className={sofieSortingLabelClassnames}>{sofieSortingLabelText}</span>
		</span>
	)
})

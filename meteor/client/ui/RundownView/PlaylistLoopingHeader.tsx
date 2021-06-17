import React from 'react'
import classNames from 'classnames'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { withTranslation } from 'react-i18next'
import { LoopingIcon } from '../../lib/ui/icons/looping'

interface ILoopingHeaderProps {
	position: 'start' | 'end'
	multiRundown?: boolean
}
export const PlaylistLoopingHeader = withTranslation()(function PlaylistLoopingHeader(
	props: Translated<ILoopingHeaderProps>
) {
	const { t, position, multiRundown } = props
	return (
		<div
			className={classNames('playlist-looping-header', {
				'multi-rundown': multiRundown,
			})}
		>
			<h3 className="playlist-looping-header__label">
				<LoopingIcon />
				&nbsp;
				{position === 'start' ? t('Loop Start') : t('Loop End')}
			</h3>
		</div>
	)
})

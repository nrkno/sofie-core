import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { UIStateStorage } from '../../lib/UIStateStorage'
import { Link } from 'react-router-dom'
import { SplitDropdown } from '../../lib/SplitDropdown'
import { getRundownPlaylistLink, getRundownWithLayoutLink, getShelfLink } from './util'
import { Rundown } from '../../../lib/collections/Rundowns'
import { RundownLayoutBase, RundownLayouts } from '../../../lib/collections/RundownLayouts'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { IconProp } from '@fortawesome/fontawesome-svg-core'

interface IRundownShelfLayoutSelectionProps {
	rundown: Rundown
}

interface IRundownShelfLayoutSelectionTrackedProps {
	rundownLayouts: RundownLayoutBase[]
}

interface IRundownShelfLayoutSelectionState {
	selectedView: string
}

export const RundownShelfLayoutSelection = translateWithTracker<
	IRundownShelfLayoutSelectionProps,
	IRundownShelfLayoutSelectionState,
	IRundownShelfLayoutSelectionTrackedProps
>((props: IRundownShelfLayoutSelectionProps) => {
	const rundownLayouts = RundownLayouts.find({ showStyleBaseId: props.rundown.showStyleBaseId }).fetch()

	return {
		...props,
		rundownLayouts,
	}
})(
	class RundownShelfLayoutSelection extends React.Component<
		Translated<IRundownShelfLayoutSelectionProps & IRundownShelfLayoutSelectionTrackedProps>,
		IRundownShelfLayoutSelectionState
	> {
		constructor(props) {
			super(props)

			this.state = {
				selectedView: UIStateStorage.getItemString(
					`rundownList.${this.props.rundown.studioId}`,
					'defaultView',
					'default'
				),
			}
		}

		private saveViewChoice(key: string) {
			UIStateStorage.setItem(`rundownList.${this.props.rundown.studioId}`, 'defaultView', key)
		}

		private renderLinkItem(layout: RundownLayoutBase, link: string, key: string) {
			return (
				<Link to={link} onClick={() => this.saveViewChoice(key)} key={key}>
					<div className="action-btn expco-item">
						<div
							className={classNames('action-btn layout-icon', { small: !layout.icon })}
							style={{ color: layout.iconColor || 'transparent' }}>
							<FontAwesomeIcon icon={(layout.icon as IconProp) || 'circle'} />
						</div>
						{layout.name}
					</div>
				</Link>
			)
		}

		render() {
			const { t } = this.props

			const standaloneLayouts = this.props.rundownLayouts
				.filter((layout) => layout.exposeAsStandalone)
				.map((layout) => {
					return this.renderLinkItem(
						layout,
						getShelfLink(this.props.rundown.playlistId, layout._id),
						`standalone${layout._id}`
					)
				})
			const shelfLayouts = this.props.rundownLayouts
				.filter((layout) => layout.exposeAsShelf)
				.map((layout) => {
					return this.renderLinkItem(
						layout,
						getRundownWithLayoutLink(this.props.rundown.playlistId, layout._id),
						`shelf${layout._id}`
					)
				})
			const allElements = [
				<div className="expco-header" key={'separator0'}>
					Standalone shelfs
				</div>,
				...standaloneLayouts,
				<div className="expco-header" key={'separator1'}>
					Rundown + Shelf
				</div>,
				...shelfLayouts,
				<div className="expco-separator" key={'separator2'}></div>,
				<Link
					to={getRundownPlaylistLink(this.props.rundown.playlistId)}
					onClick={() => this.saveViewChoice('default')}
					key={'default'}>
					<div className="action-btn expco-item">Default</div>
				</Link>,
			]
			return shelfLayouts.length > 0 || standaloneLayouts.length > 0 ? (
				<React.Fragment>
					<SplitDropdown selectedKey={this.state.selectedView}>{allElements}</SplitDropdown>
				</React.Fragment>
			) : (
				<span className="dimmed">{t('Default')}</span>
			)
		}
	}
)

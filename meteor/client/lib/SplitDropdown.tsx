import * as React from 'react'
import ClassNames from 'classnames'

import { faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface IProps {
	selectedKey: string
	className?: string
}

interface IState {
	expanded: boolean
}

export class SplitDropdown extends React.Component<IProps, IState> {
	constructor(props: IProps) {
		super(props)

		this.state = {
			expanded: false,
		}
	}

	toggleExpco = () => {
		this.setState({
			expanded: !this.state.expanded,
		})
	}

	getSelected() {
		return (
			this.props.children &&
			Array.isArray(this.props.children) &&
			(this.props.children.find((element) => (element as React.ReactElement<{}>).key === this.props.selectedKey) || (
				<div className="expco-item"></div>
			))
		)
	}

	render() {
		return (
			<div
				className={ClassNames(
					'expco button focusable subtle split-dropdown',
					{
						'expco-expanded': this.state.expanded,
					},
					this.props.className
				)}>
				<div className={ClassNames('expco-title focusable-main')}>{this.getSelected()}</div>
				<div className="action-btn right expco-expand subtle" onClick={this.toggleExpco}>
					<FontAwesomeIcon icon={faChevronUp} />
				</div>
				<div className="expco-body bd">{this.props.children}</div>
			</div>
		)
	}
}

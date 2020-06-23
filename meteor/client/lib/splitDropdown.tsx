import * as React from 'react'
import * as _ from 'underscore'
import * as ClassNames from 'classnames'

import * as faChevronUp from '@fortawesome/fontawesome-free-solid/faChevronUp'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'

interface IProps {
	elements: Array<React.ReactNode>
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
			this.props.elements.find((element) => (element as React.ReactElement<{}>).key === this.props.selectedKey) || (
				<div className="expco-item"></div>
			)
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
				<a className="action-btn right expco-expand subtle" onClick={this.toggleExpco}>
					<FontAwesomeIcon icon={faChevronUp} />
				</a>
				<div className="expco-body bd">{this.props.elements}</div>
			</div>
		)
	}
}

import * as React from 'react'
import CoreIcons from '@nrk/core-icons/jsx'
import Escape from 'react-escape'
import { mousetrapHelper } from '../../../mousetrapHelper'

export interface IModalAttributes {
	show?: boolean
	title: string
	onDiscard?: (e: SomeEvent) => void
}

export type SomeEvent = Event | React.SyntheticEvent<object>

export class Modal extends React.Component<IModalAttributes> {
	boundKeys: Array<string> = []

	constructor(props: IModalAttributes) {
		super(props)
	}

	componentDidMount() {
		this.bindKeys()
	}

	componentWillUnmount() {
		this.unbindKeys()
	}

	componentDidUpdate() {
		this.bindKeys()
	}

	bindKeys = () => {
		if (this.props.show) {
			if (this.boundKeys.indexOf('enter') < 0) {
				mousetrapHelper.bind('enter', this.preventDefault, 'keydown', undefined, true)
				mousetrapHelper.bind('enter', this.handleKey, 'keyup', undefined, true)
				this.boundKeys.push('enter')
			}
			if (this.boundKeys.indexOf('esc') < 0) {
				mousetrapHelper.bind('esc', this.preventDefault, 'keydown', undefined, true)
				mousetrapHelper.bind('esc', this.handleKey, 'keyup', undefined, true)
				this.boundKeys.push('esc')
			}
		} else {
			this.unbindKeys()
		}
	}

	unbindKeys = () => {
		this.boundKeys.forEach((key) => {
			mousetrapHelper.unbind(key, this.preventDefault, 'keydown')
			mousetrapHelper.unbind(key, this.handleKey, 'keyup')
		})
		this.boundKeys.length = 0
	}

	handleKey = (e: KeyboardEvent) => {
		if (this.props.show) {
			if (e.code === 'Escape') {
				this.handleDiscard(e)
			}
		}
	}

	handleDiscard = (e: SomeEvent) => {
		if (this.props.onDiscard && typeof this.props.onDiscard === 'function') {
			this.props.onDiscard(e)
		}
	}

	render() {
		if (!this.props.show) {
			return null
		}

		return (
			<Escape to="viewport">
				<div className="glass-pane">
					<div className="glass-pane-content">
						<dialog className="border-box">
							<div className="flex-row info vertical-align-stretch tight-s">
								<div className="flex-col c12">
									<h2>{this.props.title}</h2>
								</div>
								<div className="flex-col horizontal-align-right vertical-align-middle">
									<p>
										<button className="action-btn" onClick={this.handleDiscard}>
											<CoreIcons.NrkClose />
										</button>
									</p>
								</div>
							</div>
							<div className="title-box-content">{this.props.children}</div>
							<div className="mod alright">
								<button className="btn btn-primary" onClick={this.handleDiscard}>
									OK
								</button>
							</div>
						</dialog>
					</div>
				</div>
			</Escape>
		)
	}

	private preventDefault(e: KeyboardEvent) {
		e.preventDefault()
		e.stopPropagation()
	}
}

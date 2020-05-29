import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheckSquare, faSquare, faChevronUp } from '@fortawesome/free-solid-svg-icons'

export interface MultiSelectEvent {
	selectedValues: Array<string>
}

interface IProps {
	availableOptions: _.Dictionary<string>
	placeholder?: string
	className?: string
	value?: Array<string>
	onChange?: (event: MultiSelectEvent) => void
}

interface IState {
	checkedValues: _.Dictionary<boolean>
	expanded: boolean
}

export class MultiSelect extends React.Component<IProps, IState> {
	constructor (props: IProps) {
		super(props)

		this.state = {
			checkedValues: {},
			expanded: false
		}
	}

	componentDidMount () {
		this.refreshChecked()
	}

	componentDidUpdate (prevProps: IProps) {
		if (this.props.value !== prevProps.value) {
			this.refreshChecked()
		}
	}

	refreshChecked () {
		if (this.props.value && _.isArray(this.props.value)) {
			const checkedValues: _.Dictionary<boolean> = {}
			_.forEach(this.props.value, (value, index) => {
				checkedValues[value] = true
			})

			this.setState({
				checkedValues
			})
		} else {
			this.setState({
				checkedValues: {}
			})
		}
	}

	handleChange = (item) => {
		const obj = {}
		obj[item] = !this.state.checkedValues[item]
		const valueUpdate = _.extend(this.state.checkedValues, obj)

		this.setState({
			checkedValues: valueUpdate
		})

		if (this.props.onChange && typeof this.props.onChange === 'function') {
			this.props.onChange({
				selectedValues: _.compact(_.values(_.mapObject(valueUpdate, (value, key) => {
					return value ? key : null
				})))
			})
		}
	}

	isChecked = (key: string): boolean => {
		return !!this.state.checkedValues[key]
	}

	generateSummary = () => {
		return _.compact(_.values(_.mapObject(this.state.checkedValues, (value, key) => {
			return value ? (this.props.availableOptions[key] || key) : null
		}))).join(', ')
	}

	toggleExpco = () => {
		this.setState({
			expanded: !this.state.expanded
		})
	}

	render () {
		const summary = this.generateSummary()
		return (
			<div className={ClassNames('expco focusable subtle', {
				'expco-expanded': this.state.expanded
			}, this.props.className)}>
				<div className={ClassNames('expco-title focusable-main', {
					'placeholder': !summary
				})} onClick={this.toggleExpco}>{summary || this.props.placeholder || ''}</div>
				<a className='action-btn right expco-expand subtle' onClick={this.toggleExpco}>
					<FontAwesomeIcon icon={faChevronUp} />
				</a>
				<div className='expco-body bd'>
					{
						_.values(_.mapObject(this.props.availableOptions, (value, key) => {
							return (
								<p className='expco-item' key={key}>
									<label className='action-btn'>
										<span className='checkbox'>
											<input type='checkbox'
												className='form-control'
												checked={this.isChecked(key)}
												onChange={() => this.handleChange(key)}
											/>
											<span className='checkbox-checked'><FontAwesomeIcon icon={faCheckSquare} /></span>
											<span className='checkbox-unchecked'><FontAwesomeIcon icon={faSquare} /></span>
										</span>
										{value}
									</label>
								</p>
							)
						}))
					}
				</div>
			</div>
		)
	}
}

import * as React from 'react'
import * as _ from 'underscore'
import DatePicker from 'react-datepicker'
import * as moment from 'moment'
import Moment from 'react-moment'
import 'react-datepicker/dist/react-datepicker.css'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as faChevronRight from '@fortawesome/fontawesome-free-solid/faChevronRight'
import * as faChevronLeft from '@fortawesome/fontawesome-free-solid/faChevronLeft'
import { Time } from '../../lib/lib'

interface IProps {
	from: Time
	to: Time
	onChange: (from: Time, to: Time) => void
}
interface IState {
	dateFrom: moment.Moment
	dateTo: moment.Moment
}
export class DatePickerFromTo extends React.Component<IProps, IState> {
	constructor (props: IProps) {
		super(props)

		this.state = {
			dateFrom: 	(props.from ? moment(props.from) : moment().subtract(1,'days').startOf('day')),
			dateTo: 	(props.to 	? moment(props.to)	 : moment().startOf('day'))
		}
	}
	triggerOnchange = (state: IState) => {
		this.props.onChange(
			state.dateFrom.valueOf(),
			state.dateTo.valueOf()
		)
	}
	updateData = (o) => {
		this.setState(o)

		let newState: IState = _.extend(_.clone(this.state), o)
		this.triggerOnchange(newState)
	}
	handleChangeFrom = (date: moment.Moment) => {
		this.updateData({
			dateFrom: date,
		})
	}
	handleChangeTo = (date: moment.Moment) => {
		this.updateData({
			dateTo: date,
		})
	}
	onClickPrevious = () => {

		let from 	= this.state.dateFrom.valueOf()
		let to 		= this.state.dateTo.valueOf()
		let range 	= to - from

		this.updateData({
			dateFrom: 	moment(from - range),
			dateTo: 	moment(to 	- range)
		})
	}
	onClickNext = () => {

		let from 	= this.state.dateFrom.valueOf()
		let to 		= this.state.dateTo.valueOf()
		let range 	= to - from

		this.updateData({
			dateFrom: 	moment(from + range),
			dateTo: 	moment(to 	+ range)
		})
	}
	render () {
		return (
			<div className='datepicker-from-to'>

				<button className='btn btn-secondary' onClick={this.onClickPrevious}>
					<FontAwesomeIcon icon={faChevronLeft} />
				</button>
				<div className='picker'>
					From:
					<DatePicker dateFormat='YYYY-MM-DD' selected={this.state.dateFrom} onChange={this.handleChangeFrom} />
				</div>
				<div className='picker'>
					To:
					<DatePicker dateFormat='YYYY-MM-DD' selected={this.state.dateTo} onChange={this.handleChangeTo} />
				</div>
				<button className='btn btn-secondary' onClick={this.onClickNext}>
					<FontAwesomeIcon icon={faChevronRight} />
				</button>
			</div>
		)
	}
}

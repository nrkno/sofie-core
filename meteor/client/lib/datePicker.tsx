import * as React from 'react'
import * as _ from 'underscore'
import DatePicker from 'react-datepicker'
import * as moment from 'moment'
import 'react-datepicker/dist/react-datepicker.css'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import * as faChevronRight from '@fortawesome/fontawesome-free-solid/faChevronRight'
import * as faChevronLeft from '@fortawesome/fontawesome-free-solid/faChevronLeft'
import { Time } from '../../lib/lib'
import { translate, InjectedTranslateProps } from 'react-i18next'

interface IProps {
	from: Time
	to: Time
	onChange: (from: Time, to: Time) => void
}
interface IState {
	dateFrom: moment.Moment
	dateTo: moment.Moment
}
export const DatePickerFromTo = translate()(
	class DatePickerFromTo extends React.Component<IProps & InjectedTranslateProps, IState> {
		constructor(props: IProps & InjectedTranslateProps) {
			super(props)

			this.state = {
				dateFrom: props.from
					? moment(props.from)
					: moment()
							.subtract(1, 'days')
							.startOf('day'),
				dateTo: props.to ? moment(props.to) : moment().startOf('day'),
			}
		}
		triggerOnchange = (state: IState) => {
			this.props.onChange(state.dateFrom.valueOf(), state.dateTo.valueOf())
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
			let from = this.state.dateFrom.valueOf()
			let to = this.state.dateTo.valueOf()
			let range = to - from

			this.updateData({
				dateFrom: moment(from - range),
				dateTo: moment(to - range),
			})
		}
		onClickNext = () => {
			let from = this.state.dateFrom.valueOf()
			let to = this.state.dateTo.valueOf()
			let range = to - from

			this.updateData({
				dateFrom: moment(from + range),
				dateTo: moment(to + range),
			})
		}
		render() {
			const { t } = this.props
			return (
				<div className="datepicker-from-to">
					<button className="action-btn mod mhm" onClick={this.onClickPrevious}>
						<FontAwesomeIcon icon={faChevronLeft} />
					</button>
					<label className="mod mhs mvn">
						{t('From')}
						<div className="picker expco">
							<DatePicker
								dateFormat="YYYY-MM-DD"
								selected={this.state.dateFrom}
								onChange={this.handleChangeFrom}
								className="expco-title"
							/>
						</div>
					</label>
					<label className="mod mhs mvn">
						{t('Until')}
						<div className="picker expco">
							<DatePicker
								dateFormat="YYYY-MM-DD"
								selected={this.state.dateTo}
								onChange={this.handleChangeTo}
								className="expco-title"
							/>
						</div>
					</label>
					<button className="action-btn mod mhm" onClick={this.onClickNext}>
						<FontAwesomeIcon icon={faChevronRight} />
					</button>
				</div>
			)
		}
	}
)

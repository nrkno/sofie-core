import { useState, useEffect } from 'react'
import DatePicker from 'react-datepicker'
import moment from 'moment'
import 'react-datepicker/dist/react-datepicker.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronRight, faChevronLeft } from '@fortawesome/free-solid-svg-icons'
import { Time } from './tempLib'
import { useTranslation } from 'react-i18next'

export function DatePickerFromTo({
	from,
	to,
	onChange,
}: {
	from?: Time
	to?: Time
	onChange: (from: Time, to: Time) => void
}): JSX.Element {
	const { t } = useTranslation()

	const [localFrom, setLocalFrom] = useState<Date>(
		from ? new Date(from) : moment().subtract(1, 'days').startOf('day').toDate()
	)
	const [localTo, setLocalTo] = useState<Date>(to ? new Date(to) : moment().startOf('day').toDate())

	function onClickPrevious() {
		const from = moment(localFrom).subtract(1, 'days').valueOf()
		const to = moment(localTo).subtract(1, 'days').valueOf()

		setLocalFrom(new Date(from))
		setLocalTo(new Date(to))
	}
	function onClickNext() {
		const from = moment(localFrom).add(1, 'days').valueOf()
		const to = moment(localTo).add(1, 'days').valueOf()

		setLocalFrom(new Date(from))
		setLocalTo(new Date(to))
	}
	function handleChangeFrom(date: Date | null) {
		if (!date) return
		if (date.valueOf() >= localTo.valueOf()) {
			setLocalTo(moment(date).add(1, 'days').startOf('day').toDate())
		}
		setLocalFrom(date)
	}
	function handleChangeTo(date: Date | null) {
		if (!date) return
		if (date.valueOf() <= localFrom.valueOf()) {
			setLocalFrom(moment(date).subtract(1, 'days').startOf('day').toDate())
		}
		setLocalTo(date)
	}

	useEffect(() => {
		onChange(localFrom.valueOf(), localTo.valueOf())
	}, [localFrom, localTo])

	useEffect(() => {
		if (from) {
			setLocalFrom(from ? new Date(from) : moment().subtract(1, 'days').startOf('day').toDate())
		}
		if (to) {
			setLocalTo(to ? new Date(to) : moment().startOf('day').toDate())
		}
	}, [from, to])

	return (
		<div className="datepicker-from-to">
			<button className="action-btn mod mhm" onClick={onClickPrevious}>
				<FontAwesomeIcon icon={faChevronLeft} />
			</button>
			<label className="mod mhs mvn">
				{t('From')}
				<div className="picker expco">
					<DatePicker
						dateFormat="yyyy-MM-dd HH:mm"
						showTimeInput
						selected={localFrom}
						onChange={handleChangeFrom}
						className="expco-title"
					/>
				</div>
			</label>
			<label className="mod mhs mvn">
				{t('Until')}
				<div className="picker expco">
					<DatePicker
						dateFormat="yyyy-MM-dd HH:mm"
						showTimeInput
						selected={localTo}
						onChange={handleChangeTo}
						className="expco-title"
					/>
				</div>
			</label>
			<button className="action-btn mod mhm" onClick={onClickNext}>
				<FontAwesomeIcon icon={faChevronRight} />
			</button>
		</div>
	)
}

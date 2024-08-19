import React, { useEffect, useState, useLayoutEffect, useMemo } from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Time, unprotectString } from '../../../lib/lib'
import { UserActionsLogItem } from '../../../lib/collections/UserActionsLog'
import { DatePickerFromTo } from '../../lib/datePicker'
import moment from 'moment'
import { MeteorPubSub } from '../../../lib/api/pubsub'
import { useTranslation } from 'react-i18next'
import { parse as queryStringParse } from 'query-string'
import { Link, useHistory, useLocation } from 'react-router-dom'
import classNames from 'classnames'
import { getCoreSystem, UserActionsLog } from '../../collections'
import Tooltip from 'rc-tooltip'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { downloadBlob } from '../../lib/downloadBlob'

const PARAM_DATE_FORMAT = 'YYYY-MM-DD'
const PARAM_NAME_FROM_DATE = 'fromDate'

interface IUserActionsListProps {
	logItems: UserActionsLogItem[]
	startDate?: number
	highlighted?: string
	onItemClick?: (item: UserActionsLogItem) => void
	renderButtons?: (item: UserActionsLogItem) => React.ReactElement
}

/**
 * pretty-prints JSON content, and collapses it if it's too long.
 */
function CollapseContent(props: { content: any }): JSX.Element {
	const [expanded, setExpanded] = useState(false)

	const originalString = useMemo(() => {
		try {
			let str = JSON.stringify(JSON.parse(props.content), undefined, 2) // Pretty print JSON

			// If the JSON string is a pretty short one, use a condensed JSON instead:
			if (str.length < 200) {
				str = JSON.stringify(JSON.parse(props.content)) // Condensed JSON
			}
			return str
		} catch (_e) {
			// Ignore parsing error
			return '' + props.content
		}
	}, [props.content])

	/** Position of the 5th line in the string, 0 if not found */
	const indexOf5thLine = useMemo(() => {
		let indexOf5thLine = 0
		let foundIndex = 0
		for (let foundCount = 0; foundCount < 10; foundCount++) {
			foundIndex = originalString.indexOf('\n', foundIndex + 1)
			if (foundIndex === -1) {
				break
			} else {
				if (foundCount >= 5) {
					indexOf5thLine = foundIndex
					break
				}
			}
		}
		return indexOf5thLine
	}, [originalString])

	if (originalString.length < 100 && indexOf5thLine === 0) {
		return <pre>{originalString}</pre>
	} else {
		const displayStr = expanded
			? originalString
			: originalString.substring(0, Math.min(indexOf5thLine || 100, 100)) + '...'
		return (
			<a
				href="#"
				onClick={(e) => {
					e.preventDefault()
					setExpanded(!expanded)
				}}
			>
				<pre>{displayStr}</pre>
			</a>
		)
	}
}

function UserActionsList(props: Readonly<IUserActionsListProps>) {
	const { t } = useTranslation()

	function renderMessageHead() {
		return (
			<thead>
				<tr>
					<th className="c3 user-action-log__timestamp">{t('Timestamp')}</th>
					<th className="c3 user-action-log__executionTime">{t('Execution times')}</th>
					<th className="c1 user-action-log__userId">{t('User ID')}</th>
					<th className="c2 user-action-log__clientAddress">{t('Client IP')}</th>
					<th className="c3 user-action-log__context">{t('Action')}</th>
					<th className="c3 user-action-log__method">{t('Method')}</th>
					<th className="c1 user-action-log__status">{t('Status')}</th>
					<th className="c1 user-action-log__args">{t('Parameters')}</th>
					{props.renderButtons ? <th className="c1 user-action-log__buttons"></th> : null}
				</tr>
			</thead>
		)
	}

	return (
		<table className="table user-action-log">
			{renderMessageHead()}
			<tbody>
				{props.logItems.map((msg) => {
					const formattedTimestamp = moment(msg.timestamp).format('YYYY/MM/DD HH:mm:ss.SSS')
					const anchorId = `t${msg.timestamp}`
					const selfLink = `${location.pathname}?${PARAM_NAME_FROM_DATE}=${moment(props.startDate).format(
						PARAM_DATE_FORMAT
					)}#${anchorId}`
					return (
						<tr
							className={classNames({
								clickable: props.onItemClick,
								hl: props.highlighted === anchorId,
							})}
							key={unprotectString(msg._id)}
							onClick={() => props.onItemClick && props.onItemClick(msg)}
						>
							<td className="user-action-log__timestamp">
								<Link id={anchorId} to={selfLink}>
									{formattedTimestamp}
								</Link>
							</td>
							<td className="user-action-log__executionTime">
								<table>
									<tbody>
										{msg.clientTime ? (
											<tr>
												<td>
													<Tooltip
														overlay={t('Time from platform user event to Action received by Core')}
														placement="topLeft"
													>
														<span>{t('GUI')}:</span>
													</Tooltip>
												</td>
												<td>{Math.round((msg.timestamp - msg.clientTime) * 100) / 100} ms</td>
											</tr>
										) : null}
										{msg.executionTime ? (
											<tr>
												<td>
													<Tooltip overlay={t('Core + Worker processing time')} placement="topLeft">
														<span>{t('Core')}:</span>
													</Tooltip>
												</td>
												<td>{msg.executionTime} ms</td>
											</tr>
										) : null}
										{msg.workerTime ? (
											<tr>
												<td>{t('Worker')}:</td>
												<td>{msg.workerTime} ms</td>
											</tr>
										) : null}
										{msg.gatewayDuration ? (
											<tr>
												<td>{t('Gateway')}:</td>
												<td>{msg.gatewayDuration.join(', ')} ms</td>
											</tr>
										) : null}
										{msg.timelineResolveDuration ? (
											<tr>
												<td>{t('TSR')}:</td>
												<td>{msg.timelineResolveDuration.join(', ')} ms</td>
											</tr>
										) : null}
									</tbody>
								</table>
							</td>
							<td className="user-action-log__userId">{unprotectString(msg.userId)}</td>
							<td className="user-action-log__clientAddress">{msg.clientAddress}</td>
							<td className="user-action-log__context">{msg.context}</td>
							<td className="user-action-log__method">{msg.method}</td>
							<td className="user-action-log__status">
								{msg.success ? 'Success' : msg.success === false ? 'Error: ' + msg.errorMessage : null}
							</td>
							<td className="user-action-log__args">
								<CollapseContent content={msg.args} />
							</td>
							{props.renderButtons ? <td className="user-action-log__buttons">{props.renderButtons(msg)}</td> : null}
						</tr>
					)
				})}
			</tbody>
		</table>
	)
}

function UserActivity(): JSX.Element {
	const { t } = useTranslation()

	const [dateFrom, setDateFrom] = useState<Time>(moment().startOf('day').valueOf())
	const [dateTo, setDateTo] = useState<Time>(moment().add(1, 'days').startOf('day').valueOf())

	useSubscription(MeteorPubSub.userActionsLog, dateFrom, dateTo)

	const log = useTracker(
		() =>
			UserActionsLog.find(
				{},
				{
					sort: {
						timestamp: 1,
					},
				}
			).fetch(),
		[],
		[]
	)

	const location = useLocation()
	const history = useHistory()

	useEffect(() => {
		const queryParams = queryStringParse(location.search, {
			arrayFormat: 'comma',
		})

		const qsStartDate = moment(queryParams[PARAM_NAME_FROM_DATE], PARAM_DATE_FORMAT, true)

		if (qsStartDate.isValid()) {
			setDateFrom(qsStartDate.startOf('day').valueOf())
			setDateTo(qsStartDate.add(1, 'days').startOf('day').valueOf())
		}
	}, [location])

	function onDateChange(from: Time, to: Time) {
		setDateFrom(from)
		setDateTo(to)
		location.search = `?${PARAM_NAME_FROM_DATE}=` + moment(from).format(PARAM_DATE_FORMAT)
		history.replace(location)
	}

	const logItems = log.filter(({ timestamp }) => timestamp >= dateFrom && timestamp < dateTo)

	function onDownloadAllLogItems() {
		const coreSystem = getCoreSystem()
		const systemName = coreSystem?.name ?? 'Sofie'
		const fileName = `${systemName}_UserActionsLog_${moment(dateFrom).format(PARAM_DATE_FORMAT)}.json`

		downloadBlob(
			new Blob([JSON.stringify(logItems)], {
				type: 'application/json',
			}),
			fileName
		)
	}

	const [highlighted, setHighlighted] = useState<string | undefined>(undefined)

	function renderUserActivity() {
		return (
			<div>
				<div className="paging">
					<Tooltip overlay={t('Export visible')} placement="top">
						<button className="btn btn-secondary mod rs-right mtm" onClick={onDownloadAllLogItems}>
							<FontAwesomeIcon icon={faDownload} />
						</button>
					</Tooltip>
					<DatePickerFromTo from={dateFrom} to={dateTo} onChange={onDateChange} />
				</div>
				<UserActionsList logItems={logItems} startDate={dateFrom} highlighted={highlighted} />
			</div>
		)
	}

	useLayoutEffect(() => {
		const targetId = location.hash ? location.hash.substring(1) : undefined
		if (highlighted !== targetId && logItems.length && targetId) {
			const targetElement = document.getElementById(targetId)
			if (!targetElement) return
			targetElement.scrollIntoView()
			setHighlighted(targetId)
		}
	}, [location, location.hash, highlighted, logItems.length])

	return (
		<div className="mhl gutter external-message-status">
			<header className="mbs">
				<h1>{t('User Activity Log')}</h1>
			</header>
			<div className="mod mvl">{renderUserActivity()}</div>
		</div>
	)
}

export { UserActivity }

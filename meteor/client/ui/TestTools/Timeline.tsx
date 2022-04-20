import * as React from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { deserializeTimelineBlob, RoutedTimeline } from '../../../lib/collections/Timeline'
import { applyToArray, protectString } from '../../../lib/lib'
import { PubSub } from '../../../lib/api/pubsub'
import {
	TimelineState,
	Resolver,
	ResolvedTimelineObjectInstance,
	ResolvedTimeline,
	ResolvedTimelineObject,
	ResolvedStates,
} from 'superfly-timeline'
import { TimelineContentObject, transformTimeline } from '@sofie-automation/corelib/dist/playout/timeline'
import { getCurrentTimeReactive } from '../../lib/currentTimeReactive'
import { StudioSelect } from './StudioSelect'
import { StudioId } from '../../../lib/collections/Studios'
import { Mongo } from 'meteor/mongo'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Classnames from 'classnames'

export const StudioTimeline = new Mongo.Collection<RoutedTimeline>('studioTimeline')

interface TimelineViewRouteParams {
	studioId: string | undefined
}
function TimelineView() {
	const { t } = useTranslation()

	const { studioId } = useParams<TimelineViewRouteParams>()

	return (
		<div className="mtl gutter">
			<header className="mvs">
				<h1>{t('Timeline')}</h1>
			</header>
			<div className="mod mvl">
				{studioId && (
					<div>
						<ComponentTimelineSimulate studioId={protectString(studioId)} />
					</div>
				)}
			</div>
		</div>
	)
}

interface ITimelineSimulateProps {
	studioId: StudioId
}
function ComponentTimelineSimulate({ studioId }: ITimelineSimulateProps) {
	useSubscription(PubSub.timelineForStudio, studioId)

	const now = useTracker(() => getCurrentTimeReactive(), [], Date.now())
	const tlComplete = useTracker(() => StudioTimeline.findOne(studioId), [studioId])

	const [resolvedTl, errorMsgResolve] = useMemo(() => {
		try {
			const timelineObj = tlComplete && deserializeTimelineBlob(tlComplete.timelineBlob)
			console.log('regen timeline', tlComplete?.timelineHash, tlComplete?.generated)

			let timeline: TimelineContentObject[] = []
			if (tlComplete && timelineObj) {
				timeline = transformTimeline(
					timelineObj.sort((a, b) => {
						if (a.id > b.id) {
							return 1
						}
						if (a.id < b.id) {
							return -1
						}
						return 0
					})
				)

				// Replace now's with concrete times approximating now
				for (const obj of timeline) {
					// is part group/cap object
					applyToArray(obj.enable, (enable) => {
						if (enable.start === 'now') {
							enable.start = now
						}
					})

					const groupStart = !Array.isArray(obj.enable) ? obj.enable.start : null
					if (typeof groupStart === 'number') {
						const relativeNow = now - groupStart
						// is a piece group or piece related object
						for (const child of obj.children || []) {
							applyToArray(child.enable, (enable) => {
								if (enable.start === 'now') {
									enable.start = relativeNow
								}
							})
						}
					}
				}
			}

			// TODO - dont repeat unless changed
			const tl = Resolver.resolveTimeline(timeline, { time: tlComplete?.generated || now })
			return [tl, undefined]
		} catch (e) {
			return [undefined, `Failed to resolveTimeline:\n${e}`]
		}
	}, [tlComplete, now])

	const [allStates, errorMsgStates] = useMemo(() => {
		try {
			const states = resolvedTl ? Resolver.resolveAllStates(resolvedTl) : undefined
			return [states, undefined]
		} catch (e) {
			return [undefined, `Failed to resolveAllStates:\n${e}`]
		}
	}, [resolvedTl, now])

	return (
		<div>
			<div>
				{errorMsgResolve ? <p>{errorMsgResolve} </p> : ''}

				<h2 className="mhn">Timeline state</h2>
				{errorMsgStates ? <p>{errorMsgStates}</p> : <TimelineStateTable allStates={allStates} now={now} />}

				<div>
					<h2 className="mhn">Instances</h2>
					<TimelineInstancesTable resolvedTl={resolvedTl} />
				</div>
			</div>
		</div>
	)
}

type FilterInputValue = RegExp | string | undefined
interface FilterInputProps {
	filterChanged: (val: FilterInputValue) => void
}
function FilterInput({ filterChanged }: FilterInputProps) {
	const [filterText, setFilterText] = useState<string>('')
	const changeFilter = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setFilterText(e.target.value)
	}, [])
	const [isError, setIsError] = useState(false)

	useEffect(() => {
		if (!filterText || typeof filterText !== 'string') {
			filterChanged(undefined)
			setIsError(false)
		} else if (filterText.match(/^\/.+\/$/)) {
			try {
				filterChanged(new RegExp(filterText.substr(1, filterText.length - 2)))
				setIsError(false)
			} catch (e) {
				setIsError(true)
			}
		} else {
			filterChanged(filterText)
			setIsError(false)
		}
	}, [filterText])

	return (
		<input
			type="text"
			value={filterText}
			onChange={changeFilter}
			placeholder="Text or /RegEx/"
			className={Classnames({
				'highlight-is-error': isError,
			})}
		/>
	)
}

interface TimelineStateTableProps {
	now: number
	allStates: ResolvedStates | undefined
}
function TimelineStateTable({ allStates, now }: TimelineStateTableProps) {
	const [viewTime, setViewTime] = useState<number | null>(null)
	const selectViewTime = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
		const val = Number(e.target.value)
		setViewTime(isNaN(val) ? null : val)
	}, [])

	const state = allStates ? Resolver.getState(allStates, viewTime ?? now) : undefined
	const times = _.uniq((allStates?.nextEvents ?? []).map((e) => e.time))

	const [layerFilter, setLayerFilter] = useState<FilterInputValue>(undefined)

	return (
		<div>
			<div className="flex-row mbl">
				<div className="col mrl">
					Time:{' '}
					<select onChange={selectViewTime} value={viewTime ?? 'now'}>
						<option id="now">Now: {now}</option>
						{times.map((e) => (
							<option id={e + ''} key={e}>
								{e}
							</option>
						))}
					</select>
				</div>
				<div className="col">
					Layer Filter: <FilterInput filterChanged={setLayerFilter} />
				</div>
			</div>
			<table className="testtools-timelinetable">
				<tbody>
					<tr>
						<th>Layer</th>
						<th>id</th>
						<th>Enable</th>
						<th>Instance Times</th>
						<th>type</th>
						<th>classes</th>
						<th>content</th>
					</tr>
					{state ? renderTimelineState(state, layerFilter) : ''}
				</tbody>
			</table>
		</div>
	)
}

function renderTimelineState(state: TimelineState, filter: RegExp | string | undefined) {
	const sortedLayers = _.sortBy(Object.values(state.layers), (o) => o.layer)
	let filteredLayers: ResolvedTimelineObjectInstance[] = sortedLayers
	if (filter) {
		if (typeof filter === 'string') {
			filteredLayers = filteredLayers.filter((o) => String(o.layer).includes(filter))
		} else {
			filteredLayers = filteredLayers.filter((o) => !!String(o.layer).match(filter))
		}
	}

	return filteredLayers.map((o) => (
		<tr key={o.layer}>
			<td>{o.layer}</td>
			<td style={{ maxWidth: '25vw', minWidth: '10vw', overflowWrap: 'anywhere' }}>{o.id}</td>
			<td style={{ whiteSpace: 'pre', maxWidth: '15vw', overflowX: 'auto' }}>
				{JSON.stringify(o.enable, undefined, '\t')}
			</td>
			<td>
				Start: {o.instance.start}
				<br />
				End: {o.instance.end}
			</td>
			<td>{o.content.type}</td>
			<td>{(o.classes || []).join('<br />')}</td>
			<td style={{ whiteSpace: 'pre' }}>{JSON.stringify(o.content, undefined, '\t')}</td>
		</tr>
	))
}

interface TimelineInstancesTableProps {
	resolvedTl: ResolvedTimeline | undefined
}
function TimelineInstancesTable({ resolvedTl }: TimelineInstancesTableProps) {
	const [idFilter, setIdFilter] = useState<FilterInputValue>(undefined)

	return (
		<div>
			<div className="flex-row mbl">
				<div className="col">
					Id Filter: <FilterInput filterChanged={setIdFilter} />
				</div>
			</div>
			<table className="testtools-timelinetable">
				<tbody>
					<tr>
						<th>Id</th>
						<th>Layer</th>
						<th>Parent</th>
						<th>Instance Times</th>
					</tr>
					{resolvedTl ? renderTimelineInstances(resolvedTl, idFilter) : ''}
				</tbody>
			</table>
		</div>
	)
}

function renderTimelineInstances(resolvedTl: ResolvedTimeline, filter: RegExp | string | undefined) {
	const sortedObjects = _.sortBy(Object.values(resolvedTl.objects), (o) => `${o.layer}:::${o.id}`)

	let filteredObjects: ResolvedTimelineObject[] = sortedObjects
	if (filter) {
		if (typeof filter === 'string') {
			filteredObjects = filteredObjects.filter((o) => o.id.includes(filter))
		} else {
			filteredObjects = filteredObjects.filter((o) => !!o.id.match(filter))
		}
	}

	return filteredObjects.map((o) => (
		<tr key={o.id}>
			<td>{o.id}</td>
			<td>{o.layer}</td>
			<td>{o.resolved?.parentId ?? ''}</td>
			<td>
				{o.resolved?.instances?.map((instance) => <p key={instance.id}>{`${instance.start} - ${instance.end}`}</p>) ??
					'NONE'}
			</td>
		</tr>
	))
}

function TimelineStudioSelect() {
	return <StudioSelect path="timeline" title="Timeline" />
}

export { TimelineView, TimelineStudioSelect }

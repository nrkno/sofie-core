import * as React from 'react'
import { useSubscription, useTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import * as _ from 'underscore'
import { deserializeTimelineBlob, TimelineHash } from '../../../lib/collections/Timeline'
import { applyToArray, clone, normalizeArray, protectString } from '../../../lib/lib'
import { CustomCollectionName, PubSub } from '../../../lib/api/pubsub'
import {
	TimelineState,
	Resolver,
	ResolvedTimelineObjectInstance,
	ResolvedTimeline,
	ResolvedTimelineObject,
	ResolvedStates,
	TimelineObjectInstance,
} from 'superfly-timeline'
import { TimelineContentObject, transformTimeline } from '@sofie-automation/corelib/dist/playout/timeline'
import { getCurrentTimeReactive } from '../../lib/currentTimeReactive'
import { StudioSelect } from './StudioSelect'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Classnames from 'classnames'
import { createCustomPublicationMongoCollection } from '../../../lib/collections/lib'
import { StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'

export const StudioTimeline = createCustomPublicationMongoCollection(CustomCollectionName.StudioTimeline)

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
			const tl = Resolver.resolveTimeline(timeline as any, { time: tlComplete?.generated || now })
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

				<div>
					<h2 className="mhn">Events</h2>
					<TimelineChangesLog resolvedTl={resolvedTl} timelineHash={tlComplete?.timelineHash} />
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

interface TimelineChangesLogProps {
	timelineHash: TimelineHash | undefined
	resolvedTl: ResolvedTimeline | undefined
}

interface ChangeEntry {
	forceShow?: boolean
	msg: string
}

function TimelineChangesLog({ resolvedTl, timelineHash }: TimelineChangesLogProps) {
	const [lastResolvedTl, setLastResolvedTl] = useState<ResolvedTimeline | null>(null)
	const [idFilter, setIdFilter] = useState<FilterInputValue>(undefined)

	const [entries, setEntries] = useState<ChangeEntry[]>([])

	useEffect(() => {
		setEntries((old) => [
			...old,
			{
				forceShow: true,
				msg: `New timeline ${timelineHash}!`,
			},
		])
	}, [timelineHash])

	useEffect(() => {
		const newEntries: ChangeEntry[] = [
			// {
			// 	msg: 'New timeline!',
			// },
		]

		if (resolvedTl && lastResolvedTl) {
			const keys = Array.from(
				new Set([...Object.keys(lastResolvedTl.objects), ...Object.keys(resolvedTl.objects)])
			).sort()

			for (const objectId of keys) {
				const oldObj = lastResolvedTl.objects[objectId] as ResolvedTimelineObject | undefined
				const newObj = resolvedTl.objects[objectId] as ResolvedTimelineObject | undefined

				if (oldObj && !newObj) {
					newEntries.push({ msg: `Object "${objectId}" removed` })
				} else if (!oldObj && newObj) {
					newEntries.push({ msg: `Object "${objectId}" added with ${newObj.resolved.instances.length} instances` })
					for (const instance of newObj.resolved.instances) {
						newEntries.push({
							msg: `Instance "${objectId}${instance.id}" added - start: ${instance.start} end: ${instance.end}`,
						})
					}
				} else if (newObj && oldObj) {
					const oldInstancesMap = normalizeArray(oldObj.resolved.instances, 'id')
					const newInstancesMap = normalizeArray(newObj.resolved.instances, 'id')

					const instanceKeys = Array.from(
						new Set([...Object.keys(oldInstancesMap), ...Object.keys(newInstancesMap)])
					).sort()

					for (const instanceId of instanceKeys) {
						const oldInstance = oldInstancesMap[instanceId] as TimelineObjectInstance | undefined
						const newInstance = newInstancesMap[instanceId] as TimelineObjectInstance | undefined

						if (oldInstance && !newInstance) {
							newEntries.push({ msg: `Instance "${objectId}${oldInstance.id}" removed` })
						} else if (!oldInstance && newInstance) {
							newEntries.push({
								msg: `Instance "${objectId}${newInstance.id}" added - start: ${newInstance.start} end: ${newInstance.end}`,
							})
						} else if (newInstance && oldInstance) {
							let changes = ''

							if (newInstance.start !== oldInstance.start)
								changes += ` start: ${newInstance.start} !== ${oldInstance.start}`
							if (newInstance.end !== oldInstance.end) changes += ` end: ${newInstance.end} !== ${oldInstance.end}`

							if (changes.length > 0) {
								newEntries.push({ msg: `Instance "${objectId}${oldInstance.id}" changed:${changes}` })
							}
						} else {
							// Ignore instance that is not present in either
						}
					}
				} else {
					// Ignore object that is not present in either
				}
			}
		}

		if (newEntries.length) setEntries((old) => [...old, ...newEntries])
		setLastResolvedTl(clone(resolvedTl) || null)
	}, [resolvedTl])

	const doClear = useCallback(() => {
		setEntries([])
	}, [])

	const showEntries = useMemo(() => {
		if (idFilter) {
			if (typeof idFilter === 'string') {
				return entries.filter((o) => o.forceShow || o.msg.includes(idFilter))
			} else {
				return entries.filter((o) => o.forceShow || !!o.msg.match(idFilter))
			}
		} else {
			return entries
		}
	}, [entries, idFilter])

	return (
		<div>
			<div className="flex-row mbl">
				<div className="col">
					Id Filter: <FilterInput filterChanged={setIdFilter} />
				</div>
				<div className="col">
					<button onClick={doClear}>Clear Events</button>
				</div>
			</div>
			<table className="testtools-timelinetable">
				<tbody>
					<tr>
						<th>Msg</th>
					</tr>
					{showEntries.map((e, i) => (
						<tr key={i}>
							<td>{e.msg}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	)
}

function TimelineStudioSelect() {
	return <StudioSelect path="timeline" title="Timeline" />
}

export { TimelineView, TimelineStudioSelect }

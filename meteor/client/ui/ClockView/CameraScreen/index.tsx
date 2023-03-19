import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { CameraContent, RemoteContent, SourceLayerType, SplitsContent } from '@sofie-automation/blueprints-integration'
import { RundownId, ShowStyleBaseId, StudioId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Rundown } from '@sofie-automation/corelib/dist/dataModel/Rundown'
import { unprotectString } from '@sofie-automation/corelib/dist/protectedString'
import { PubSub } from '../../../../lib/api/pubsub'
import { UIStudio } from '../../../../lib/api/studios'
import { RundownPlaylist } from '../../../../lib/collections/RundownPlaylists'
import { PieceExtended } from '../../../../lib/Rundown'
import { PartInstances, Rundowns } from '../../../collections'
import { useSubscription, useTracker } from '../../../lib/ReactMeteorData/ReactMeteorData'
import { UIStudios } from '../../Collections'
import { Rundown as RundownComponent } from './Rundown'
import { useLocation } from 'react-router-dom'
import { parse as queryStringParse } from 'query-string'
import { PartInstance } from '../../../../lib/collections/PartInstances'
import { OrderedPartsProvider } from './OrderedPartsProvider'
import { offElementResize, onElementResize } from '../../../lib/resizeObserver'
import { useTranslation } from 'react-i18next'

interface IProps {
	playlist: RundownPlaylist | undefined
	studioId: StudioId
}

interface IActivePartInstancesContext {
	currentPartInstance: PartInstance | undefined
	nextPartInstance: PartInstance | undefined
}

type FilterFuction = (piece: PieceExtended) => boolean

export const StudioContext = React.createContext<UIStudio | undefined>(undefined)
export const RundownToShowStyleContext = React.createContext<Map<RundownId, ShowStyleBaseId>>(new Map())
export const PieceFilter = React.createContext<FilterFuction>(() => true)
export const ActivePartInstancesContext = React.createContext<IActivePartInstancesContext>({
	currentPartInstance: undefined,
	nextPartInstance: undefined,
})
export const AreaZoom = React.createContext<number>(1)
export const CanvasSizeContext = React.createContext<number>(1)

const PARAM_NAME_STUDIO_LABEL = 'studioLabels'
const PARAM_NAME_SOURCE_LAYER_IDS = 'sourceLayerIds'

export function CameraScreen({ playlist, studioId }: IProps): JSX.Element | null {
	const playlistIds = playlist ? [playlist._id] : []

	const [studioLabels, setStudioLabels] = useState<string[] | null>(null)
	const [sourceLayerIds, setSourceLayerIds] = useState<string[] | null>(null)

	const location = useLocation()
	useEffect(() => {
		const queryParams = queryStringParse(location.search, {
			arrayFormat: 'comma',
		})

		const studioLabelParam = queryParams[PARAM_NAME_STUDIO_LABEL] ?? null
		const sourceLayerTypeParam = queryParams[PARAM_NAME_SOURCE_LAYER_IDS] ?? null

		setStudioLabels(
			Array.isArray(studioLabelParam) ? studioLabelParam : studioLabelParam === null ? null : [studioLabelParam]
		)
		setSourceLayerIds(
			Array.isArray(sourceLayerTypeParam)
				? sourceLayerTypeParam
				: sourceLayerTypeParam === null
				? null
				: [sourceLayerTypeParam]
		)
	}, [location.search])

	const rundowns = useTracker(
		() =>
			Rundowns.find({
				playlistId: {
					$in: playlistIds,
				},
			}).fetch(),
		[playlistIds.join(',')],
		[] as Rundown[]
	)

	const rundownIds = useMemo(() => rundowns.map((rundown) => rundown._id), [rundowns])
	const showStyleBaseIds = useMemo(() => rundowns.map((rundown) => rundown.showStyleBaseId), [rundowns])

	useSubscription(PubSub.rundowns, playlistIds, null)
	useSubscription(PubSub.segments, {
		rundownId: {
			$in: rundownIds,
		},
	})
	useSubscription(PubSub.uiStudio, studioId)
	useSubscription(PubSub.partInstances, rundownIds, playlist?.activationId)

	useSubscription(PubSub.parts, rundownIds)

	useSubscription(PubSub.pieceInstancesSimple, {
		rundownId: {
			$in: rundownIds,
		},
	})

	useSubscription(PubSub.pieces, {
		startRundownId: {
			$in: rundownIds,
		},
	})

	const currentPartInstance = useTracker(
		() => (playlist?.currentPartInstanceId ? PartInstances.findOne(playlist?.currentPartInstanceId) : undefined),
		[playlist?.currentPartInstanceId],
		undefined
	)
	const nextPartInstance = useTracker(
		() => (playlist?.nextPartInstanceId ? PartInstances.findOne(playlist?.nextPartInstanceId) : undefined),
		[playlist?.nextPartInstanceId],
		undefined
	)

	const partInstanceContext = useMemo(
		() => ({
			currentPartInstance,
			nextPartInstance,
		}),
		[currentPartInstance, nextPartInstance]
	)

	useEffect(() => {
		document.body.classList.add('dark', 'xdark', 'vertical-overflow-only')

		const containerEl = document.querySelector('#render-target > .container-fluid.header-clear')
		if (containerEl) containerEl.classList.remove('header-clear')

		return () => {
			document.body.classList.remove('dark', 'xdark', 'vertical-overflow-only')
			if (containerEl) containerEl.classList.add('header-clear')
		}
	}, [])

	const studio = useTracker(() => UIStudios.findOne(studioId), [studioId], undefined)

	const rundownToShowStyle = useMemo(() => {
		const result = new Map<RundownId, ShowStyleBaseId>()
		rundowns.forEach((rundown) => {
			result.set(rundown._id, rundown.showStyleBaseId)
		})
		return result
	}, [rundowns.map((rundown) => rundown._id).join(','), showStyleBaseIds.join(',')])

	const pieceFilterFunction = useMemo(() => {
		return (piece: PieceExtended) => {
			const camLikeContent = piece.instance.piece.content as CameraContent | RemoteContent
			if (
				sourceLayerIds !== null &&
				(piece.sourceLayer?._id === undefined || !sourceLayerIds.includes(piece.sourceLayer?._id))
			)
				return false
			if (studioLabels !== null) {
				if (piece.sourceLayer?.type === SourceLayerType.SPLITS) {
					const splitContent = piece.instance.piece.content as SplitsContent
					if (!splitContent.boxSourceConfiguration.find((item) => studioLabels.includes(item.studioLabel))) return false
				} else {
					if (!studioLabels.includes(camLikeContent.studioLabel)) return false
				}
			}
			if (sourceLayerIds === null && (piece.sourceLayer?.isHidden || !piece.outputLayer?.isPGM)) return false
			return true
		}
	}, [studioLabels, sourceLayerIds])

	const [canvasWidth, setCanvasWidth] = useState(1)

	const canvasElRef = useRef<HTMLDivElement>(null)

	const { t } = useTranslation()

	useLayoutEffect(() => {
		const canvasEl = canvasElRef.current
		const dimentions = canvasEl?.getBoundingClientRect()

		setCanvasWidth(dimentions?.width ?? 1)

		if (!canvasEl) return

		function onReisze(entries: ResizeObserverEntry[]): void {
			setCanvasWidth(entries[0].borderBoxSize[0].inlineSize)
		}

		const observer = onElementResize(canvasEl, onReisze)

		return () => {
			offElementResize(observer, canvasEl)
			observer.disconnect()
		}
	}, [canvasElRef.current])

	if (!studio) return <h1 className="mod mal alc">{t("This studio doesn't exist.")}</h1>

	if (!playlist) return <h1 className="mod mal alc">{t('There is no rundown active in this studio.')}</h1>

	const rundownIdsBefore: RundownId[] = []

	return (
		<StudioContext.Provider value={studio}>
			<RundownToShowStyleContext.Provider value={rundownToShowStyle}>
				<PieceFilter.Provider value={pieceFilterFunction}>
					<OrderedPartsProvider>
						<ActivePartInstancesContext.Provider value={partInstanceContext}>
							<AreaZoom.Provider value={0.01}>
								<CanvasSizeContext.Provider value={canvasWidth}>
									<div className="camera-screen" ref={canvasElRef}>
										{rundowns.map((rundown) => {
											rundownIdsBefore.push(rundown._id)
											return (
												<RundownComponent
													key={unprotectString(rundown._id)}
													playlist={playlist}
													rundown={rundown}
													rundownIdsBefore={rundownIdsBefore.slice(0, -1)}
												/>
											)
										})}
									</div>
								</CanvasSizeContext.Provider>
							</AreaZoom.Provider>
						</ActivePartInstancesContext.Provider>
					</OrderedPartsProvider>
				</PieceFilter.Provider>
			</RundownToShowStyleContext.Provider>
		</StudioContext.Provider>
	)
}

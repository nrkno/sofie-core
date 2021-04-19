import {
	RundownLayoutBase,
	RundownLayout,
	DashboardLayout,
	RundownLayoutType,
	RundownLayoutId,
	RundownLayoutElementBase,
	RundownLayoutFilterBase,
	RundownLayoutElementType,
	RundownLayoutExternalFrame,
	RundownLayoutAdLibRegion,
	PieceDisplayStyle,
	RundownLayoutPieceCountdown,
	RundownViewLayout,
	RundownLayoutTopBar,
	LayoutFactory,
} from '../collections/RundownLayouts'
import { ShowStyleBaseId } from '../collections/ShowStyleBases'
import * as _ from 'underscore'

export interface NewRundownLayoutsAPI {
	createRundownLayout(
		name: string,
		type: RundownLayoutType,
		showStyleBaseId: ShowStyleBaseId
	): Promise<RundownLayoutId>
	removeRundownLayout(id: RundownLayoutId): Promise<void>
}

export enum RundownLayoutsAPIMethods {
	'removeRundownLayout' = 'rundownLayout.removeRundownLayout',
	'createRundownLayout' = 'rundownLayout.createRundownLayout',
}

interface LayoutDescriptor<T extends RundownLayoutBase> {
	factory: LayoutFactory<T>
	supportedElements: RundownLayoutElementType[]
}

class RundownLayoutsRegistry {
	private shelfLayouts: Map<RundownLayoutType, LayoutDescriptor<RundownLayoutBase>> = new Map()
	private rundownViewLayouts: Map<RundownLayoutType, LayoutDescriptor<RundownLayoutBase>> = new Map()
	private miniShelfLayouts: Map<RundownLayoutType, LayoutDescriptor<RundownLayoutBase>> = new Map()
	private topBarLayouts: Map<RundownLayoutType, LayoutDescriptor<RundownLayoutBase>> = new Map()

	public RegisterShelfLayout(id: RundownLayoutType, description: LayoutDescriptor<RundownLayoutBase>) {
		this.shelfLayouts.set(id, description)
	}

	public RegisterRundownViewLayout(id: RundownLayoutType, description: LayoutDescriptor<RundownLayoutBase>) {
		this.rundownViewLayouts.set(id, description)
	}

	public RegisterMiniShelfLayout(id: RundownLayoutType, description: LayoutDescriptor<RundownLayoutBase>) {
		this.miniShelfLayouts.set(id, description)
	}

	public RegisterTopBarLayouts(id: RundownLayoutType, description: LayoutDescriptor<RundownLayoutBase>) {
		this.topBarLayouts.set(id, description)
	}

	public IsShelfLayout(id: RundownLayoutType) {
		return this.shelfLayouts.has(id)
	}

	public IsRudownViewLayout(id: RundownLayoutType) {
		return this.rundownViewLayouts.has(id)
	}

	public IsMiniShelfLayout(id: RundownLayoutType) {
		return this.miniShelfLayouts.has(id)
	}

	public IsTopBarLayout(id: RundownLayoutType) {
		return this.topBarLayouts.has(id)
	}
}

export namespace RundownLayoutsAPI {
	const registry = new RundownLayoutsRegistry()
	registry.RegisterShelfLayout(RundownLayoutType.DASHBOARD_LAYOUT, {
		factory: { createLayout: () => undefined },
		supportedElements: [
			RundownLayoutElementType.ADLIB_REGION,
			RundownLayoutElementType.EXTERNAL_FRAME,
			RundownLayoutElementType.FILTER,
			RundownLayoutElementType.PIECE_COUNTDOWN,
		],
	})
	registry.RegisterShelfLayout(RundownLayoutType.RUNDOWN_LAYOUT, {
		factory: { createLayout: () => undefined },
		supportedElements: [
			RundownLayoutElementType.ADLIB_REGION,
			RundownLayoutElementType.EXTERNAL_FRAME,
			RundownLayoutElementType.FILTER,
			RundownLayoutElementType.PIECE_COUNTDOWN,
		],
	})
	registry.RegisterMiniShelfLayout(RundownLayoutType.DASHBOARD_LAYOUT, {
		factory: { createLayout: () => undefined },
		supportedElements: [],
	})
	registry.RegisterMiniShelfLayout(RundownLayoutType.RUNDOWN_LAYOUT, {
		factory: { createLayout: () => undefined },
		supportedElements: [],
	})
	registry.RegisterRundownViewLayout(RundownLayoutType.RUNDOWN_VIEW_LAYOUT, {
		factory: { createLayout: () => undefined },
		supportedElements: [],
	})
	registry.RegisterTopBarLayouts(RundownLayoutType.TOP_BAR_LAYOUT, {
		factory: { createLayout: () => undefined },
		supportedElements: [],
	})

	export function IsLayoutForShelf(layout: RundownLayoutBase): layout is RundownLayoutBase {
		return registry.IsShelfLayout(layout.type)
	}

	export function IsLayoutForRundownView(layout: RundownLayoutBase): layout is RundownLayoutBase {
		return registry.IsRudownViewLayout(layout.type)
	}

	export function IsLayoutForMiniShelf(layout: RundownLayoutBase): layout is RundownLayoutBase {
		return registry.IsMiniShelfLayout(layout.type)
	}

	export function IsLayoutForTopBar(layout: RundownLayoutBase): layout is RundownLayoutBase {
		return registry.IsTopBarLayout(layout.type)
	}

	export function isRundownViewLayout(layout: RundownLayoutBase): layout is RundownViewLayout {
		return layout.type === RundownLayoutType.RUNDOWN_VIEW_LAYOUT
	}

	export function isRundownLayout(layout: RundownLayoutBase): layout is RundownLayout {
		return layout.type === RundownLayoutType.RUNDOWN_LAYOUT
	}

	export function isDashboardLayout(layout: RundownLayoutBase): layout is DashboardLayout {
		return layout.type === RundownLayoutType.DASHBOARD_LAYOUT
	}

	export function isTopBarLayout(layout: RundownLayoutBase): layout is RundownLayoutTopBar {
		return layout.type === RundownLayoutType.TOP_BAR_LAYOUT
	}

	export function isFilter(element: RundownLayoutElementBase): element is RundownLayoutFilterBase {
		return element.type === undefined || element.type === RundownLayoutElementType.FILTER
	}

	export function isExternalFrame(element: RundownLayoutElementBase): element is RundownLayoutExternalFrame {
		return element.type === RundownLayoutElementType.EXTERNAL_FRAME
	}

	export function isAdLibRegion(element: RundownLayoutElementBase): element is RundownLayoutAdLibRegion {
		return element.type === RundownLayoutElementType.ADLIB_REGION
	}

	export function isPieceCountdown(element: RundownLayoutElementBase): element is RundownLayoutPieceCountdown {
		return element.type === RundownLayoutElementType.PIECE_COUNTDOWN
	}

	export function adLibRegionToFilter(element: RundownLayoutAdLibRegion): RundownLayoutFilterBase {
		return {
			..._.pick(element, '_id', 'name', 'rank', 'tags'),
			rundownBaseline: true,
			type: RundownLayoutElementType.FILTER,
			sourceLayerIds: [],
			sourceLayerTypes: [],
			outputLayerIds: [],
			label: [],
			displayStyle: PieceDisplayStyle.BUTTONS,
			currentSegment: false,
			showThumbnailsInList: false,
			nextInCurrentPart: false,
			oneNextPerSourceLayer: false,
			hideDuplicates: false,
		}
	}
}

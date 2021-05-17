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
	RundownLayoutKeyboardPreview,
	RundownLayoutPieceCountdown,
	RundownLayoutNextInfo,
	RundownViewLayout,
	RundownLayoutRundownHeader,
	RundownLayoutShelfBase,
} from '../collections/RundownLayouts'
import { ShowStyleBaseId } from '../collections/ShowStyleBases'
import * as _ from 'underscore'
import { literal } from '../lib'

export interface NewRundownLayoutsAPI {
	createRundownLayout(
		name: string,
		type: RundownLayoutType,
		showStyleBaseId: ShowStyleBaseId,
		regionId: string
	): Promise<RundownLayoutId>
	removeRundownLayout(id: RundownLayoutId): Promise<void>
}

export enum RundownLayoutsAPIMethods {
	'removeRundownLayout' = 'rundownLayout.removeRundownLayout',
	'createRundownLayout' = 'rundownLayout.createRundownLayout',
}

export interface LayoutDescriptor<T extends RundownLayoutBase> {
	supportedElements: RundownLayoutElementType[]
	filtersTitle?: string // e.g. tabs/panels
}

export interface CustomizableRegionSettingsManifest {
	_id: string
	title: string
	layouts: Array<CustomizableRegionLayout>
}

export interface CustomizableRegionLayout {
	_id: string
	type: RundownLayoutType
	filtersTitle?: string
	supportedElements: RundownLayoutElementType[]
}

class RundownLayoutsRegistry {
	private shelfLayouts: Map<RundownLayoutType, LayoutDescriptor<RundownLayoutShelfBase>> = new Map()
	private rundownViewLayouts: Map<RundownLayoutType, LayoutDescriptor<RundownViewLayout>> = new Map()
	private miniShelfLayouts: Map<RundownLayoutType, LayoutDescriptor<RundownLayoutShelfBase>> = new Map()
	private rundownHeaderLayouts: Map<RundownLayoutType, LayoutDescriptor<RundownLayoutRundownHeader>> = new Map()

	public RegisterShelfLayout(id: RundownLayoutType, description: LayoutDescriptor<RundownLayoutShelfBase>) {
		this.shelfLayouts.set(id, description)
	}

	public RegisterRundownViewLayout(id: RundownLayoutType, description: LayoutDescriptor<RundownLayoutBase>) {
		this.rundownViewLayouts.set(id, description)
	}

	public RegisterMiniShelfLayout(id: RundownLayoutType, description: LayoutDescriptor<RundownLayoutBase>) {
		this.miniShelfLayouts.set(id, description)
	}

	public RegisterRundownHeaderLayouts(id: RundownLayoutType, description: LayoutDescriptor<RundownLayoutBase>) {
		this.rundownHeaderLayouts.set(id, description)
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

	public IsRundownHeaderLayout(id: RundownLayoutType) {
		return this.rundownHeaderLayouts.has(id)
	}

	public GetSettingsManifest(): CustomizableRegionSettingsManifest[] {
		return [
			{
				_id: 'shelf_layouts',
				title: 'Shelf Layouts',
				layouts: Array.from(this.shelfLayouts.entries()).map(([layoutType, descriptor]) => {
					return literal<CustomizableRegionLayout>({
						_id: layoutType,
						type: layoutType,
						filtersTitle: descriptor.filtersTitle,
						supportedElements: descriptor.supportedElements,
					})
				}),
			},
			{
				_id: 'rundown_view_layouts',
				title: 'Rundown View Layouts',
				layouts: Array.from(this.rundownViewLayouts.entries()).map(([layoutType, descriptor]) => {
					return literal<CustomizableRegionLayout>({
						_id: layoutType,
						type: layoutType,
						filtersTitle: descriptor.filtersTitle,
						supportedElements: descriptor.supportedElements,
					})
				}),
			},
			{
				_id: 'mini_shelf_layouts',
				title: 'Mini Shelf Layouts',
				layouts: Array.from(this.miniShelfLayouts.entries()).map(([layoutType, descriptor]) => {
					return literal<CustomizableRegionLayout>({
						_id: layoutType,
						type: layoutType,
						filtersTitle: descriptor.filtersTitle,
						supportedElements: descriptor.supportedElements,
					})
				}),
			},
			{
				_id: 'rundown_header_layouts',
				title: 'Rundown Header Layouts',
				layouts: Array.from(this.rundownHeaderLayouts.entries()).map(([layoutType, descriptor]) => {
					return literal<CustomizableRegionLayout>({
						_id: layoutType,
						type: layoutType,
						filtersTitle: descriptor.filtersTitle,
						supportedElements: descriptor.supportedElements,
					})
				}),
			},
		]
	}
}

export namespace RundownLayoutsAPI {
	const registry = new RundownLayoutsRegistry()
	registry.RegisterShelfLayout(RundownLayoutType.RUNDOWN_LAYOUT, {
		filtersTitle: 'Panels',
		supportedElements: [
			RundownLayoutElementType.ADLIB_REGION,
			RundownLayoutElementType.EXTERNAL_FRAME,
			RundownLayoutElementType.FILTER,
			RundownLayoutElementType.PIECE_COUNTDOWN,
		],
	})
	registry.RegisterShelfLayout(RundownLayoutType.DASHBOARD_LAYOUT, {
		filtersTitle: 'Tabs',
		supportedElements: [
			RundownLayoutElementType.ADLIB_REGION,
			RundownLayoutElementType.EXTERNAL_FRAME,
			RundownLayoutElementType.FILTER,
			RundownLayoutElementType.PIECE_COUNTDOWN,
		],
	})
	registry.RegisterMiniShelfLayout(RundownLayoutType.DASHBOARD_LAYOUT, {
		supportedElements: [],
	})
	registry.RegisterMiniShelfLayout(RundownLayoutType.RUNDOWN_LAYOUT, {
		supportedElements: [],
	})
	registry.RegisterRundownViewLayout(RundownLayoutType.RUNDOWN_VIEW_LAYOUT, {
		supportedElements: [],
	})
	registry.RegisterRundownHeaderLayouts(RundownLayoutType.RUNDOWN_HEADER_LAYOUT, {
		supportedElements: [],
	})

	export function GetSettingsManifest(): CustomizableRegionSettingsManifest[] {
		return registry.GetSettingsManifest()
	}

	export function IsLayoutForShelf(layout: RundownLayoutBase): layout is RundownLayoutShelfBase {
		return registry.IsShelfLayout(layout.type)
	}

	export function IsLayoutForRundownView(layout: RundownLayoutBase): layout is RundownLayoutBase {
		return registry.IsRudownViewLayout(layout.type)
	}

	export function IsLayoutForMiniShelf(layout: RundownLayoutBase): layout is RundownLayoutShelfBase {
		return registry.IsMiniShelfLayout(layout.type)
	}

	export function IsLayoutForRundownHeader(layout: RundownLayoutBase): layout is RundownLayoutRundownHeader {
		return registry.IsRundownHeaderLayout(layout.type)
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

	export function isRundownHeaderLayout(layout: RundownLayoutBase): layout is RundownLayoutRundownHeader {
		return layout.type === RundownLayoutType.RUNDOWN_HEADER_LAYOUT
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

	export function isKeyboardMap(element: RundownLayoutElementBase): element is RundownLayoutKeyboardPreview {
		return element.type === RundownLayoutElementType.KEYBOARD_PREVIEW
	}

	export function isPieceCountdown(element: RundownLayoutElementBase): element is RundownLayoutPieceCountdown {
		return element.type === RundownLayoutElementType.PIECE_COUNTDOWN
	}

	export function isNextInfo(element: RundownLayoutElementBase): element is RundownLayoutNextInfo {
		return element.type === RundownLayoutElementType.NEXT_INFO
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
			hideDuplicates: false,
			nextInCurrentPart: false,
			oneNextPerSourceLayer: false,
		}
	}
}

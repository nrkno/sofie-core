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
	RundownLayoutRundownHeader,
	RundownLayoutShelfBase,
	CustomizableRegions,
	RundownLayoutPlaylistStartTimer,
	RundownLayoutPlaylistEndTimer,
	RundownLayoutEndWords,
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
	supportsFilters?: boolean
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
	supportsFilters?: boolean
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

	public IsShelfLayout(regionId: string) {
		return regionId === CustomizableRegions.Shelf
	}

	public IsRudownViewLayout(regionId: string) {
		return regionId === CustomizableRegions.RundownView
	}

	public IsMiniShelfLayout(regionId: string) {
		return regionId === CustomizableRegions.MiniShelf
	}

	public IsRundownHeaderLayout(regionId: string) {
		return regionId === CustomizableRegions.RundownHeader
	}

	private wrapToCustomizableRegionLayout(
		layouts: Map<RundownLayoutType, LayoutDescriptor<RundownLayoutBase>>
	): CustomizableRegionLayout[] {
		return Array.from(layouts.entries()).map(([layoutType, descriptor]) => {
			return literal<CustomizableRegionLayout>({
				_id: layoutType,
				type: layoutType,
				...descriptor,
			})
		})
	}

	public GetSettingsManifest(): CustomizableRegionSettingsManifest[] {
		return [
			{
				_id: CustomizableRegions.RundownView,
				title: 'Rundown View Layouts',
				layouts: this.wrapToCustomizableRegionLayout(this.rundownViewLayouts),
			},
			{
				_id: CustomizableRegions.Shelf,
				title: 'Shelf Layouts',
				layouts: this.wrapToCustomizableRegionLayout(this.shelfLayouts),
			},
			{
				_id: CustomizableRegions.MiniShelf,
				title: 'Mini Shelf Layouts',
				layouts: this.wrapToCustomizableRegionLayout(this.miniShelfLayouts),
			},
			{
				_id: CustomizableRegions.RundownHeader,
				title: 'Rundown Header Layouts',
				layouts: this.wrapToCustomizableRegionLayout(this.rundownHeaderLayouts),
			},
		]
	}
}

export namespace RundownLayoutsAPI {
	const registry = new RundownLayoutsRegistry()
	registry.RegisterShelfLayout(RundownLayoutType.RUNDOWN_LAYOUT, {
		filtersTitle: 'Panels',
		supportsFilters: true,
		supportedElements: [
			RundownLayoutElementType.ADLIB_REGION,
			RundownLayoutElementType.EXTERNAL_FRAME,
			RundownLayoutElementType.FILTER,
			RundownLayoutElementType.PIECE_COUNTDOWN,
		],
	})
	registry.RegisterShelfLayout(RundownLayoutType.DASHBOARD_LAYOUT, {
		filtersTitle: 'Tabs',
		supportsFilters: true,
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
	registry.RegisterRundownHeaderLayouts(RundownLayoutType.DASHBOARD_LAYOUT, {
		filtersTitle: 'Layout Elements',
		supportsFilters: true,
		supportedElements: [
			RundownLayoutElementType.PIECE_COUNTDOWN,
			RundownLayoutElementType.PLAYLIST_START_TIMER,
			RundownLayoutElementType.PLAYLIST_END_TIMER,
			RundownLayoutElementType.END_WORDS,
		],
	})

	export function GetSettingsManifest(): CustomizableRegionSettingsManifest[] {
		return registry.GetSettingsManifest()
	}

	export function IsLayoutForShelf(layout: RundownLayoutBase): layout is RundownLayoutShelfBase {
		return registry.IsShelfLayout(layout.regionId)
	}

	export function IsLayoutForRundownView(layout: RundownLayoutBase): layout is RundownViewLayout {
		return registry.IsRudownViewLayout(layout.regionId)
	}

	export function IsLayoutForMiniShelf(layout: RundownLayoutBase): layout is RundownLayoutShelfBase {
		return registry.IsMiniShelfLayout(layout.regionId)
	}

	export function IsLayoutForRundownHeader(layout: RundownLayoutBase): layout is RundownLayoutRundownHeader {
		return registry.IsRundownHeaderLayout(layout.regionId)
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

	export function isPieceCountdown(element: RundownLayoutElementBase): element is RundownLayoutPieceCountdown {
		return element.type === RundownLayoutElementType.PIECE_COUNTDOWN
	}

	export function isPlaylistStartTimer(
		element: RundownLayoutElementBase
	): element is RundownLayoutPlaylistStartTimer {
		return element.type === RundownLayoutElementType.PLAYLIST_START_TIMER
	}

	export function isPlaylistEndTimer(element: RundownLayoutElementBase): element is RundownLayoutPlaylistEndTimer {
		return element.type === RundownLayoutElementType.PLAYLIST_END_TIMER
	}

	export function isEndWords(element: RundownLayoutElementBase): element is RundownLayoutEndWords {
		return element.type === RundownLayoutElementType.END_WORDS
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

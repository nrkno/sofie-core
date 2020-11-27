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
	RundownLayoutPartCountdown,
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

export namespace RundownLayoutsAPI {
	export function isRundownLayout(layout: RundownLayoutBase): layout is RundownLayout {
		return layout.type === RundownLayoutType.RUNDOWN_LAYOUT
	}

	export function isDashboardLayout(layout: RundownLayoutBase): layout is DashboardLayout {
		return layout.type === RundownLayoutType.DASHBOARD_LAYOUT
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

	export function isPartCountdown(element: RundownLayoutElementBase): element is RundownLayoutPartCountdown {
		return element.type === RundownLayoutElementType.PART_COUNTDOWN
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
		}
	}
}

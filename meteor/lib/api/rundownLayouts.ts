import { RundownLayoutBase, RundownLayout, DashboardLayout, RundownLayoutType, RundownLayoutElementBase, RundownLayoutFilter, RundownLayoutElementType, RundownLayoutFilterBase, RundownLayoutExternalFrame, RundownLayoutMultiView, PieceDisplayStyle } from '../collections/RundownLayouts'
import * as _ from 'underscore'

export namespace RundownLayoutsAPI {
	export enum methods {
		'removeRundownLayout' = 'rundown.removeRundownLayout',
		'createRundownLayout' = 'rundown.createRundownLayout'
	}

	export function isRundownLayout (layout: RundownLayoutBase): layout is RundownLayout {
		return layout.type === RundownLayoutType.RUNDOWN_LAYOUT
	}

	export function isDashboardLayout (layout: RundownLayoutBase): layout is DashboardLayout {
		return layout.type === RundownLayoutType.DASHBOARD_LAYOUT
	}

	export function isFilter (element: RundownLayoutElementBase): element is RundownLayoutFilterBase {
		return element.type === undefined || element.type === RundownLayoutElementType.FILTER
	}

	export function isExternalFrame (element: RundownLayoutElementBase): element is RundownLayoutExternalFrame {
		return element.type === RundownLayoutElementType.EXTERNAL_FRAME
	}

	export function isMultiView (element: RundownLayoutElementBase): element is RundownLayoutMultiView {
		return element.type === RundownLayoutElementType.MULTIVIEW
	}

	export function multiViewToFilter (element: RundownLayoutMultiView): RundownLayoutFilterBase {
		return {
			...(_.pick(element, '_id', 'name', 'rank', 'tags')),
			rundownBaseline: true,
			type: RundownLayoutElementType.FILTER,
			sourceLayerIds: [],
			sourceLayerTypes: [],
			outputLayerIds: [],
			label: [],
			displayStyle: PieceDisplayStyle.BUTTONS,
			currentSegment: false
		}
	}
}

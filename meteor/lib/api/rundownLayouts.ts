import { RundownLayoutBase, RundownLayout, DashboardLayout, RundownLayoutType, RundownLayoutId } from '../collections/RundownLayouts'
import { ShowStyleBaseId } from '../collections/ShowStyleBases'

export interface NewRundownLayoutsAPI {
	createRundownLayout (name: string, type: RundownLayoutType, showStyleBaseId: ShowStyleBaseId): Promise<RundownLayoutId>
	removeRundownLayout (id: RundownLayoutId): Promise<void>
}

export enum RundownLayoutsAPIMethods {
	'removeRundownLayout' = 'rundownLayout.removeRundownLayout',
	'createRundownLayout' = 'rundownLayout.createRundownLayout'
}

export namespace RundownLayoutsAPI {
	export enum methods {
		// 'removeRundownLayout' = 'rundown.removeRundownLayout',
		// 'createRundownLayout' = 'rundown.createRundownLayout'
	}

	export function isRundownLayout (layout: RundownLayoutBase): layout is RundownLayout {
		return layout.type === RundownLayoutType.RUNDOWN_LAYOUT
	}

	export function isDashboardLayout (layout: RundownLayoutBase): layout is DashboardLayout {
		return layout.type === RundownLayoutType.DASHBOARD_LAYOUT
	}
}

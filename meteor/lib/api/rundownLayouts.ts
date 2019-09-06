import { RundownLayoutBase, RundownLayout, DashboardLayout, RundownLayoutType } from '../collections/RundownLayouts'

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
}

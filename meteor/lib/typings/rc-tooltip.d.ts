declare namespace RCTooltip {
	export type Trigger = 'hover' | 'click' | 'focus'
	export type Placement = 'left' | 'right' | 'top' | 'bottom' | 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight'

	export interface Props extends React.Props<any> {
		overlayClassName?: string
		trigger?: Trigger[]
		mouseEnterDelay?: number
		mouseLeaveDelay?: number
		overlayStyle?: React.CSSProperties
		prefixCls?: string
		transitionName?: string
		onVisibleChange?: (visible?: boolean) => void
		afterVisibleChange?: (visible?: boolean) => void
		visible?: boolean
		defaultVisible?: boolean
		placement?: Placement | Object
		align?: Object
		onPopupAlign?: (popupDomNode: Element, align: Object) => void
		overlay: React.ReactNode
		arrowContent?: React.ReactNode
		getTooltipContainer?: () => Element
		destroyTooltipOnHide?: boolean
		id?: string
	}
}

declare module 'rc-tooltip' {
	import * as React from 'react'

	class Tooltip extends React.Component<RCTooltip.Props> {}

	export = Tooltip
}

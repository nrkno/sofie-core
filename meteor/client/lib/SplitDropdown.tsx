import React, { useState, PropsWithChildren, ReactNode } from 'react'
import ClassNames from 'classnames'

import { faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface IProps {
	selectedKey: string
	className?: string
	children?: SplitDropdownItemObj[]
}

interface IState {
	expanded: boolean
}

interface SplitDropdownItemObj {
	key?: string
	children?: ReactNode
}

export function SplitDropdownItem(props: SplitDropdownItemObj): SplitDropdownItemObj {
	return {
		key: props.key,
		children: props.children,
	}
}

export function SplitDropdown(props: IProps) {
	const [expanded, setExpanded] = useState(false)

	function getSelected() {
		const selectedChild =
			props.children &&
			Array.isArray(props.children) &&
			props.children.find((element) => element.key === props.selectedKey)?.children
		return selectedChild ? <>{selectedChild}</> : <div className="expco-item"></div>
	}

	function toggleExpco() {
		setExpanded(!expanded)
	}

	return (
		<div
			className={ClassNames(
				'expco button focusable subtle split-dropdown',
				{
					'expco-expanded': expanded,
				},
				props.className
			)}>
			<div className="expco-title focusable-main">{getSelected()}</div>
			<div className="action-btn right expco-expand subtle" onClick={toggleExpco}>
				<FontAwesomeIcon icon={faChevronUp} />
			</div>
			<div className="expco-body bd">
				{props.children?.map((child, index) => (
					<React.Fragment key={child.key || index}>{child.children}</React.Fragment>
				))}
			</div>
		</div>
	)
}

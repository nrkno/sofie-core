import { SomeAction } from '@sofie-automation/blueprints-integration'
import * as React from 'react'

interface IProps {
	action: SomeAction
}

export const ActionEditor: React.FC<IProps> = function ActionEditor(props: IProps): React.ReactElement | null {
	return <>{props.action.action}</>
}

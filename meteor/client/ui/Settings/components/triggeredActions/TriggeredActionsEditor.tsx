import * as React from 'react'
import { PubSub } from '../../../../../lib/api/pubsub'
import { ShowStyleBaseId } from '../../../../../lib/collections/ShowStyleBases'
import { TriggeredActions } from '../../../../../lib/collections/TriggeredActions'
import { useSubscription, useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData'

interface IProps {
	showStyleBaseId: ShowStyleBaseId | undefined
}

export const TriggeredActionsEditor: React.FC<IProps> = function TriggeredActionsEditor(
	props: IProps
): React.ReactElement | null {
	const { showStyleBaseId } = props
	const showStyleBaseSelector =
		showStyleBaseId === undefined
			? {
					showStyleBaseId: {
						$exists: false,
					},
			  }
			: {
					showStyleBaseId: showStyleBaseId,
			  }

	useSubscription(PubSub.triggeredActions, showStyleBaseSelector)

	useTracker(() => {
		TriggeredActions.find(showStyleBaseSelector).fetch()
	}, [showStyleBaseId])

	return null
}

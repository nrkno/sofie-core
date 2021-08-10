import * as React from 'react'
import Sorensen from 'sorensen'
import { useTranslation } from 'react-i18next'
import { useSubscription, useTracker } from '../../../../lib/ReactMeteorData/ReactMeteorData'
import { PubSub } from '../../../../../lib/api/pubsub'
import { ShowStyleBaseId } from '../../../../../lib/collections/ShowStyleBases'
import { TriggeredActions } from '../../../../../lib/collections/TriggeredActions'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { TriggeredActionEntry } from './TriggeredActionEntry'
import { unprotectString } from '../../../../../lib/lib'
import { useEffect, useState } from 'react'

export const SorensenContext = React.createContext<null | typeof Sorensen>(null)

interface IProps {
	showStyleBaseId: ShowStyleBaseId | undefined
}

export const TriggeredActionsEditor: React.FC<IProps> = function TriggeredActionsEditor(
	props: IProps
): React.ReactElement | null {
	const [localSorensen, setLocalSorensen] = useState<null | typeof Sorensen>(null)
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

	const triggeredActions = useTracker(() => TriggeredActions.find(showStyleBaseSelector).fetch(), [showStyleBaseId])

	const { t } = useTranslation()
	useEffect(() => {
		Sorensen.init()
			.then(() => {
				setLocalSorensen(Sorensen)
			})
			.catch(console.error)

		return () => {
			Sorensen.destroy().catch(console.error)
		}
	}, [])

	return (
		<div>
			<SorensenContext.Provider value={localSorensen}>
				<h2 className="mhn">{t('Action Triggers')}</h2>
				<div className="mod mhn">
					{triggeredActions?.map((triggeredAction) => (
						<TriggeredActionEntry key={unprotectString(triggeredAction._id)} triggeredAction={triggeredAction} />
					))}
				</div>
				<div className="mod mhs">
					<button className="btn btn-primary" onClick={() => {}}>
						<FontAwesomeIcon icon={faPlus} />
					</button>
				</div>
			</SorensenContext.Provider>
		</div>
	)
}

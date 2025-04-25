import * as React from 'react'
import { StudioRouteSet, StudioAbPlayerDisabling } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { doModalDialog } from '../../../../lib/ModalDialog'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { useTranslation } from 'react-i18next'
import { literal } from '@sofie-automation/corelib/dist/lib'
import { LabelAndOverrides } from '../../../../lib/Components/LabelAndOverrides'
import {
	OverrideOpHelper,
	OverrideOpHelperForItemContents,
	WrappedOverridableItemNormal,
} from '../../util/OverrideOpHelper'
import { TextInputControl } from '../../../../lib/Components/TextInput'
import { OverrideOpHelperArrayTable } from '../../../../lib/forms/SchemaFormTable/ArrayTableOpHelper'

interface RouteSetAbPlayersProps {
	routeSet: WrappedOverridableItemNormal<StudioRouteSet>
	overrideHelper: OverrideOpHelper
}

export function RouteSetAbPlayers({ routeSet, overrideHelper }: Readonly<RouteSetAbPlayersProps>): React.JSX.Element {
	const { t } = useTranslation()

	const tableOverrideHelper = React.useCallback(
		() => new OverrideOpHelperArrayTable(overrideHelper(), routeSet.id, routeSet.computed.abPlayers, 'abPlayers'),
		[overrideHelper, routeSet.id, routeSet.computed.abPlayers]
	)

	const confirmRemoveAbPlayer = React.useCallback(
		(route: WrappedOverridableItemNormal<StudioAbPlayerDisabling>) => {
			doModalDialog({
				title: t('Remove this AB PLayers from this Route Set?'),
				yes: t('Remove'),
				no: t('Cancel'),
				onAccept: () => {
					tableOverrideHelper().deleteRow(route.id).commit()
				},
				message: (
					<>
						<p>
							{t('Are you sure you want to remove the AB Player "{{playerId}}"?', {
								playerId: route.computed.playerId,
							})}
						</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</>
				),
			})
		},
		[tableOverrideHelper]
	)

	return (
		<>
			<h4 className="mod mhs">{t('AB Playout devices')}</h4>
			<p className="text-s dimmed field-hint mhs">
				{t(
					'Any AB Playout devices here will only be active when this or another RouteSet that includes them is active'
				)}
			</p>
			{routeSet.computed.abPlayers.length === 0 ? (
				<p className="text-s dimmed field-hint mhs">{t('There are no AB Playout devices set up yet')}</p>
			) : (
				routeSet.computed.abPlayers.map((route, index) => (
					<AbPlayerRow
						key={index}
						tableOverrideHelper={tableOverrideHelper}
						abPlayer={route}
						index={index}
						confirmRemoveAbPlayer={confirmRemoveAbPlayer}
					/>
				))
			)}
		</>
	)
}

interface AbPlayerRowProps {
	tableOverrideHelper: OverrideOpHelperForItemContents
	abPlayer: StudioAbPlayerDisabling
	index: number
	confirmRemoveAbPlayer: (route: WrappedOverridableItemNormal<any>) => void
}

function AbPlayerRow({
	tableOverrideHelper,
	abPlayer,
	index,
	confirmRemoveAbPlayer,
}: Readonly<AbPlayerRowProps>): React.JSX.Element {
	const { t } = useTranslation()

	const player = React.useMemo(
		() =>
			literal<WrappedOverridableItemNormal<StudioAbPlayerDisabling>>({
				type: 'normal',
				id: index + '',
				computed: abPlayer,
				defaults: undefined,
				overrideOps: [],
			}),
		[abPlayer, index]
	)

	const confirmRemoveRouteLocal = React.useCallback(
		() => confirmRemoveAbPlayer(player),
		[confirmRemoveAbPlayer, player]
	)

	return (
		<div className="route-sets-editor mod pan mas">
			<button className="action-btn right mod man pas" onClick={confirmRemoveRouteLocal}>
				<FontAwesomeIcon icon={faTrash} />
			</button>
			<div className="properties-grid">
				<LabelAndOverrides
					label={t('Pool name')}
					item={player}
					itemKey={'poolName'}
					overrideHelper={tableOverrideHelper}
				>
					{(value, handleUpdate) => (
						<TextInputControl
							modifiedClassName="bghl"
							classNames="input text-input input-l"
							value={value}
							handleUpdate={handleUpdate}
						/>
					)}
				</LabelAndOverrides>
				<LabelAndOverrides
					label={t('Pool PlayerId')}
					item={player}
					itemKey={'playerId'}
					overrideHelper={tableOverrideHelper}
				>
					{(value, handleUpdate) => (
						<TextInputControl
							modifiedClassName="bghl"
							classNames="input text-input input-l"
							value={value}
							handleUpdate={handleUpdate}
						/>
					)}
				</LabelAndOverrides>
			</div>
		</div>
	)
}

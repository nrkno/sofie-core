import React, { useEffect, useLayoutEffect, useState } from 'react'
import { ClientActions, PlayoutActions, SomeAction } from '@sofie-automation/blueprints-integration'
import { useTranslation } from 'react-i18next'
import { TFunction } from 'i18next'
import { assertNever } from '../../../../../../../lib/lib'
import { sameWidth } from '../../../../../../lib/popperUtils'
import { usePopper } from 'react-popper'
import classNames from 'classnames'
import { EditAttribute } from '../../../../../../lib/EditAttribute'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTrash } from '@fortawesome/free-solid-svg-icons'

interface IProps {
	action: SomeAction
	opened?: boolean
	onFocus?: () => void
	onChange: (newVal: SomeAction) => void
	onRemove: () => void
	onClose?: () => void
	onSetFilter?: () => void
}

function hasArguments(action: SomeAction): boolean {
	switch (action.action) {
		case PlayoutActions.activateRundownPlaylist:
			return true
		case PlayoutActions.adlib:
			return false
		case PlayoutActions.createSnapshotForDebug:
			return false
		case PlayoutActions.deactivateRundownPlaylist:
			return false
		case PlayoutActions.disableNextPiece:
			return false
		case PlayoutActions.hold:
			return true
		case PlayoutActions.moveNext:
			return true
		case PlayoutActions.reloadRundownPlaylistData:
			return false
		case PlayoutActions.resetRundownPlaylist:
			return false
		case PlayoutActions.take:
			return true
		case PlayoutActions.resyncRundownPlaylist:
			return true
		case ClientActions.shelf:
			return true
		default:
			assertNever(action)
			return action
	}
}

function actionToLabel(t: TFunction, action: SomeAction['action']): string {
	switch (action) {
		case PlayoutActions.activateRundownPlaylist:
			return t('Activate Rundown')
		case PlayoutActions.adlib:
			return t('Ad-Lib')
		case PlayoutActions.createSnapshotForDebug:
			return t('Store Snapshot')
		case PlayoutActions.deactivateRundownPlaylist:
			return t('Deactivate Rundown')
		case PlayoutActions.disableNextPiece:
			return t('Disable next Piece')
		case PlayoutActions.hold:
			return t('Hold')
		case PlayoutActions.moveNext:
			return t('Move Next')
		case PlayoutActions.reloadRundownPlaylistData:
			return t('Reload NRCS Data')
		case PlayoutActions.resetRundownPlaylist:
			return t('Reset Rundown')
		case PlayoutActions.take:
			return t('Take')
		case PlayoutActions.resyncRundownPlaylist:
			return t('Resync with NRCS')
		case ClientActions.shelf:
			return t('Shelf')
		default:
			assertNever(action)
			return action
	}
}

function getAvailableActions(t: TFunction): Record<string, string> {
	const actionEnums = [PlayoutActions, ClientActions]

	const result: Record<string, string> = {}

	actionEnums.forEach((enumList) => {
		Object.values(enumList).forEach((key) => {
			result[actionToLabel(t, key)] = key
		})
	})

	return result
}

export const ActionSelector = function ActionSelector({
	action,
	opened,
	onFocus,
	onClose,
	onRemove,
	onSetFilter,
	onChange,
}: IProps) {
	const [referenceElement, setReferenceElement] = useState<HTMLDivElement | null>(null)
	const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null)
	const { styles, attributes, update } = usePopper(referenceElement, popperElement, {
		modifiers: [
			{
				name: 'offset',
				options: {
					offset: [0, -30],
				},
			},
			sameWidth,
		],
	})

	useEffect(() => {
		function closeHandler(e: MouseEvent) {
			const composedPath = e.composedPath()
			if (
				popperElement &&
				referenceElement &&
				!composedPath.includes(popperElement) &&
				!composedPath.includes(referenceElement)
			) {
				onClose && onClose()
			}
		}

		if (opened) {
			document.body.addEventListener('click', closeHandler)
		}

		return () => {
			document.body.removeEventListener('click', closeHandler)
		}
	}, [popperElement, referenceElement, opened])

	useLayoutEffect(() => {
		update && update().catch(console.error)
	}, [action])

	const { t } = useTranslation()
	return (
		<>
			<div
				ref={setReferenceElement}
				className={classNames('triggered-action-entry__action__type clickable', {
					focused: opened,
					hasArguments: hasArguments(action),
				})}
				tabIndex={0}
				role="button"
				onClick={onFocus}
			>
				{actionToLabel(t, action.action)}
			</div>
			{opened ? (
				<div
					className="expco expco-expanded expco-popper mod pas ptl expco-popper-rounded triggered-action-entry__action-editor"
					ref={setPopperElement}
					style={styles.popper}
					{...attributes.popper}
				>
					<div>
						<EditAttribute
							className="form-control input text-input input-m"
							modifiedClassName="bghl"
							type={'dropdown'}
							label={t('Action')}
							options={getAvailableActions(t)}
							overrideDisplayValue={action.action}
							attribute={''}
							updateFunction={(_e, newVal) => {
								onChange({
									...action,
									action: newVal,
								})
							}}
						/>
					</div>
					<div className="mts">
						<button className="btn btn-tight btn-secondary" onClick={onRemove}>
							<FontAwesomeIcon icon={faTrash} />
						</button>
						<button
							className="btn right btn-tight btn-primary"
							onClick={() => {
								onClose && onClose()
								onSetFilter && onSetFilter()
							}}
						>
							{t('Set Filters')}
						</button>
					</div>
				</div>
			) : null}
		</>
	)
}

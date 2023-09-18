import React, { useEffect, useLayoutEffect, useState } from 'react'
import { ClientActions, PlayoutActions, SomeAction } from '@sofie-automation/blueprints-integration'
import { useTranslation } from 'react-i18next'
import { TFunction } from 'react-i18next'
import { assertNever } from '../../../../../../../lib/lib'
import { sameWidth } from '../../../../../../lib/popperUtils'
import { usePopper } from 'react-popper'
import classNames from 'classnames'
import { EditAttribute } from '../../../../../../lib/EditAttribute'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faAngleRight, faTrash } from '@fortawesome/free-solid-svg-icons'
import { AdLibActionEditor } from './actionEditors/AdLibActionEditor'
import { DeviceActions } from '@sofie-automation/shared-lib/dist/core/model/ShowStyle'
import { catchError } from '../../../../../../lib/lib'

interface IProps {
	action: SomeAction
	opened?: boolean
	onFocus?: () => void
	onChange: (newVal: SomeAction) => void
	onRemove: () => void
	onClose?: () => void
	onSetFilter?: () => void
}

function getArguments(t: TFunction, action: SomeAction): string[] {
	const result: string[] = []
	switch (action.action) {
		case PlayoutActions.activateRundownPlaylist:
			if (action.force) {
				result.push(t('Force'))
			}
			if (action.rehearsal) {
				result.push(t('Rehearsal'))
			}
			break
		case PlayoutActions.adlib:
			if (action.arguments) {
				result.push(t('Mode: {{triggerMode}}', { triggerMode: action.arguments.triggerMode }))
			}
			break
		case PlayoutActions.createSnapshotForDebug:
			break
		case PlayoutActions.deactivateRundownPlaylist:
			break
		case PlayoutActions.activateScratchpadMode:
			break
		case PlayoutActions.disableNextPiece:
			if (action.undo) {
				result.push(t('Undo'))
			}
			break
		case PlayoutActions.hold:
			if (action.undo) {
				result.push(t('Undo'))
			}
			break
		case PlayoutActions.moveNext:
			if (action.segments) {
				result.push(t('Segments: {{delta}}', { delta: (action.segments > 0 ? '+' : '') + action.segments }))
			}
			if (action.parts) {
				result.push(t('Parts: {{delta}}', { delta: (action.parts > 0 ? '+' : '') + action.parts }))
			}
			break
		case PlayoutActions.reloadRundownPlaylistData:
			break
		case PlayoutActions.resetRundownPlaylist:
			break
		case PlayoutActions.take:
			break
		case PlayoutActions.resyncRundownPlaylist:
			break
		case ClientActions.shelf:
			if (action.state === true) {
				result.push(t('Open'))
			} else if (action.state === false) {
				result.push(t('Close'))
			} else if (action.state === 'toggle') {
				result.push(t('Toggle'))
			} else {
				assertNever(action.state)
			}
			break
		case ClientActions.goToOnAirLine:
			break
		case ClientActions.rewindSegments:
			break
		case ClientActions.showEntireCurrentSegment:
			if (action.on === true) {
				result.push(t('On'))
			} else {
				result.push(t('Off'))
			}
			break
		case ClientActions.miniShelfQueueAdLib:
			result.push(t('Forward: {{forward}}', { forward: action.forward }))
			break
		case DeviceActions.modifyShiftRegister:
			result.push(`${action.register ?? '?'}: ${action.operation ?? '?'}${action.value ?? '?'}`)
			break
		default:
			assertNever(action)
			return action
	}
	return result
}

function hasArguments(action: SomeAction): boolean {
	switch (action.action) {
		case PlayoutActions.activateRundownPlaylist:
			return action.force || action.rehearsal
		case PlayoutActions.adlib:
			return !!action.arguments
		case PlayoutActions.createSnapshotForDebug:
			return false
		case PlayoutActions.deactivateRundownPlaylist:
			return false
		case PlayoutActions.activateScratchpadMode:
			return false
		case PlayoutActions.disableNextPiece:
			return !!action.undo
		case PlayoutActions.hold:
			return !!action.undo
		case PlayoutActions.moveNext:
			return !!(action.parts || action.segments)
		case PlayoutActions.reloadRundownPlaylistData:
			return false
		case PlayoutActions.resetRundownPlaylist:
			return false
		case PlayoutActions.take:
			return false
		case PlayoutActions.resyncRundownPlaylist:
			return false
		case ClientActions.shelf:
			return true
		case ClientActions.goToOnAirLine:
			return false
		case ClientActions.rewindSegments:
			return false
		case ClientActions.showEntireCurrentSegment:
			return true
		case ClientActions.miniShelfQueueAdLib:
			return true
		case DeviceActions.modifyShiftRegister:
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
		case PlayoutActions.activateScratchpadMode:
			return t('Activate Scratchpad')
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
		case ClientActions.rewindSegments:
			return t('Rewind Segments to start')
		case ClientActions.goToOnAirLine:
			return t('Go to On Air line')
		case ClientActions.showEntireCurrentSegment:
			return t('Show entire On Air Segment')
		case ClientActions.miniShelfQueueAdLib:
			return t('Queue AdLib from Minishelf')
		case DeviceActions.modifyShiftRegister:
			return t('Modify Shift register')
		default:
			assertNever(action)
			return action
	}
}

function getAvailableActions(t: TFunction): Record<string, string> {
	const actionEnums = [PlayoutActions, ClientActions, DeviceActions]

	const result: Record<string, string> = {}

	actionEnums.forEach((enumList) => {
		Object.values<any>(enumList).forEach((key) => {
			result[actionToLabel(t, key)] = key
		})
	})

	return result
}

function getActionParametersEditor(
	t: TFunction,
	action: SomeAction,
	onChange: (newVal: Partial<typeof action>) => void
): React.ReactElement | null {
	switch (action.action) {
		case PlayoutActions.activateRundownPlaylist:
			return (
				<div className="mts">
					<EditAttribute
						className="form-control"
						modifiedClassName="bghl"
						type={'toggle'}
						label={t('Rehearsal')}
						overrideDisplayValue={action.rehearsal}
						attribute={''}
						updateFunction={(_e, newVal) => {
							onChange({
								...action,
								rehearsal: newVal,
							})
						}}
					/>
					<EditAttribute
						className="form-control"
						modifiedClassName="bghl"
						type={'toggle'}
						label={t('Force (deactivate others)')}
						overrideDisplayValue={action.force}
						attribute={''}
						updateFunction={(_e, newVal) => {
							onChange({
								...action,
								force: newVal,
							})
						}}
					/>
				</div>
			)
		case PlayoutActions.adlib:
			return <AdLibActionEditor action={action} onChange={onChange} />
		case PlayoutActions.createSnapshotForDebug:
			return null
		case PlayoutActions.deactivateRundownPlaylist:
			return null
		case PlayoutActions.activateScratchpadMode:
			return null
		case PlayoutActions.disableNextPiece:
			return (
				<div className="mts">
					<EditAttribute
						className="form-control"
						modifiedClassName="bghl"
						type={'toggle'}
						label={t('Undo')}
						overrideDisplayValue={action.undo}
						attribute={''}
						updateFunction={(_e, newVal) => {
							onChange({
								...action,
								undo: newVal,
							})
						}}
					/>
				</div>
			)
		case PlayoutActions.hold:
			return (
				<div className="mts">
					<EditAttribute
						className="form-control"
						modifiedClassName="bghl"
						type={'toggle'}
						label={t('Undo')}
						overrideDisplayValue={action.undo}
						attribute={''}
						updateFunction={(_e, newVal) => {
							onChange({
								...action,
								undo: newVal,
							})
						}}
					/>
				</div>
			)
		case PlayoutActions.moveNext:
			return (
				<div className="mts">
					<label className="block">{t('Move Segments')}</label>
					<EditAttribute
						className="form-control input text-input input-m"
						modifiedClassName="bghl"
						type={'int'}
						label={t('By Segments')}
						overrideDisplayValue={action.segments}
						attribute={''}
						updateFunction={(_e, newVal) => {
							onChange({
								...action,
								segments: newVal,
							})
						}}
					/>
					<label className="block">{t('Move Parts')}</label>
					<EditAttribute
						className="form-control input text-input input-m"
						modifiedClassName="bghl"
						type={'int'}
						label={t('By Parts')}
						overrideDisplayValue={action.parts}
						attribute={''}
						updateFunction={(_e, newVal) => {
							onChange({
								...action,
								parts: newVal,
							})
						}}
					/>
				</div>
			)
		case PlayoutActions.reloadRundownPlaylistData:
			return null
		case PlayoutActions.resetRundownPlaylist:
			return null
		case PlayoutActions.take:
			return null
		case PlayoutActions.resyncRundownPlaylist:
			return null
		case ClientActions.shelf:
			return (
				<div className="mts">
					<label className="block">{t('State')}</label>
					<EditAttribute
						className="form-control input text-input input-m"
						modifiedClassName="bghl"
						type={'dropdown'}
						label={t('State')}
						options={{
							[t('Open')]: true,
							[t('Close')]: false,
							[t('Toggle')]: 'toggle',
						}}
						overrideDisplayValue={action.state}
						attribute={''}
						updateFunction={(_e, newVal) => {
							onChange({
								...action,
								state: newVal,
							})
						}}
					/>
				</div>
			)
		case ClientActions.goToOnAirLine:
			return null
		case ClientActions.rewindSegments:
			return null
		case ClientActions.showEntireCurrentSegment:
			return (
				<div className="mts">
					<EditAttribute
						className="form-control"
						modifiedClassName="bghl"
						type={'toggle'}
						label={t('On')}
						overrideDisplayValue={action.on}
						attribute={''}
						updateFunction={(_e, newVal) => {
							onChange({
								...action,
								on: newVal,
							})
						}}
					/>
				</div>
			)
		case ClientActions.miniShelfQueueAdLib:
			return (
				<div className="mts">
					<EditAttribute
						className="form-control"
						modifiedClassName="bghl"
						type={'toggle'}
						label={t('Forward')}
						overrideDisplayValue={action.forward}
						attribute={''}
						updateFunction={(_e, newVal) => {
							onChange({
								...action,
								forward: newVal,
							})
						}}
					/>
				</div>
			)
		case DeviceActions.modifyShiftRegister:
			return (
				<div className="mts">
					<label className="block">{t('Register ID')}</label>
					<EditAttribute
						className="form-control input text-input input-m"
						modifiedClassName="bghl"
						type="int"
						overrideDisplayValue={action.register}
						updateFunction={(_e, newVal) => {
							onChange({
								...action,
								register: Math.max(0, Number(newVal)),
							})
						}}
					/>
					<label className="block">{t('Operation')}</label>
					<EditAttribute
						className="form-control input text-input input-m"
						modifiedClassName="bghl"
						type="dropdown"
						overrideDisplayValue={action.operation}
						attribute={''}
						options={{
							[t('Set')]: '=',
							[t('Add')]: '+',
							[t('Subtract')]: '-',
						}}
						updateFunction={(_e, newVal) => {
							onChange({
								...action,
								operation: newVal,
							})
						}}
					/>
					<label className="block">{t('Value')}</label>
					<EditAttribute
						className="form-control input text-input input-m"
						modifiedClassName="bghl"
						type="int"
						overrideDisplayValue={action.value}
						attribute={''}
						updateFunction={(_e, newVal) => {
							onChange({
								...action,
								value: newVal,
							})
						}}
					/>
					<label className="block">{t('Minimum register limit')}</label>
					<EditAttribute
						className="form-control input text-input input-m"
						modifiedClassName="bghl"
						type="int"
						overrideDisplayValue={action.limitMin}
						attribute={''}
						updateFunction={(_e, newVal) => {
							onChange({
								...action,
								limitMin: newVal,
							})
						}}
					/>
					<label className="block">{t('Maximum register limit')}</label>
					<EditAttribute
						className="form-control input text-input input-m"
						modifiedClassName="bghl"
						type="int"
						overrideDisplayValue={action.limitMax}
						attribute={''}
						updateFunction={(_e, newVal) => {
							onChange({
								...action,
								limitMax: newVal,
							})
						}}
					/>
				</div>
			)
		default:
			assertNever(action)
			return action
	}
}

export const ActionSelector = function ActionSelector({
	action,
	opened,
	onFocus,
	onClose,
	onRemove,
	onSetFilter,
	onChange,
}: IProps): JSX.Element {
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
		update && update().catch(catchError('ActionSelector update'))
	}, [action])

	const { t } = useTranslation()

	const actionArguments = getArguments(t, action)

	return (
		<>
			<div
				ref={setReferenceElement}
				className={classNames('triggered-action-entry__action__type clickable', {
					focused: opened,
					'has-arguments': hasArguments(action),
				})}
				tabIndex={0}
				role="button"
				onClick={onFocus}
			>
				{actionToLabel(t, action.action)}
				{actionArguments.length > 0 ? <span className="arguments">{actionArguments.join(', ')}</span> : null}
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
					{getActionParametersEditor(t, action, (newVal: Partial<typeof action>) => {
						onChange({
							...action,
							// typescript doesn't seem to recognize that if action and newVal are of equal type, they must inherently be compatible
							...(newVal as any),
						})
					})}
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
							<FontAwesomeIcon icon={faAngleRight} />
						</button>
					</div>
				</div>
			) : null}
		</>
	)
}

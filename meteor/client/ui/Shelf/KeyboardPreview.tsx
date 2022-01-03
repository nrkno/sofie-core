import * as React from 'react'
import * as _ from 'underscore'
import ClassNames from 'classnames'
import { SourceLayerLookup } from './AdLibPanel'
import { IHotkeyAssignment } from '../../lib/hotkeyRegistry'
import { Translated, translateWithTracker, useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { RundownUtils } from '../../lib/rundown'
import { ShowStyleBase, HotkeyDefinition } from '../../../lib/collections/ShowStyleBases'
import { PhysicalLayout, KeyPositon } from '../../../lib/keyboardLayout'
import {
	isMountedAdLibTrigger,
	MountedAdLibTrigger,
	MountedAdLibTriggers,
	MountedGenericTrigger,
	MountedGenericTriggers,
} from '../../lib/triggers/TriggersHandler'
import { getFinalKey, keyLabelsToCodes } from '../../lib/triggers/codesToKeyLabels'
import { Sorensen } from '@sofie-automation/sorensen'
import { normalizeArray } from '../../../lib/lib'
import { translateMessage } from '../../../lib/api/TranslatableMessage'
import { TFunction } from 'i18next'
import {
	convertToLenientModifiers,
	MODIFIER_MAP,
} from '../Settings/components/triggeredActions/triggerEditors/HotkeyEditor'
import RundownViewEventBus, { RundownViewEvents } from '../RundownView/RundownViewEventBus'

const _isMacLike = navigator.platform.match(/(Mac|iPhone|iPod|iPad)/i) ? true : false

declare global {
	type KeyboardLayoutMap = Map<string, string>

	type KeyboardLayoutEvents = 'layoutchange'

	interface Keyboard {
		getLayoutMap(): Promise<KeyboardLayoutMap>
		addEventListener(type: KeyboardLayoutEvents, listener: EventListener): void
		removeEventListener(type: KeyboardLayoutEvents, listener: EventListener): void
	}

	interface Navigator {
		keyboard: Keyboard
	}
}

export interface IHotkeyAssignmentExtended extends IHotkeyAssignment {
	finalKey: string
	normalizedCombo: string
}

export type ParsedHotkeyAssignments = {
	[modifiers: string]: IHotkeyAssignmentExtended[]
}

export enum SpecialKeyPositions {
	BLANK_SPACE = '$space',
}

export interface IProps {
	physicalLayout: PhysicalLayout
	showStyleBase: ShowStyleBase
	sorensen: Sorensen | undefined
}

interface ITrackedProps {
	customLabels: { [key: string]: HotkeyDefinition }
	hotkeyOverrides: { [key: string]: string }
	sourceLayerLookup: SourceLayerLookup
}

interface IState {
	layout: KeyboardLayoutMap | undefined
	keyDown: { [key: string]: boolean }
}

export enum GenericFuncionalKeyLabels {
	Backspace = '⌫',
	Tab = 'Tab ⭾',
	CapsLock = 'CapsLock',
	Enter = 'Enter',
	ShiftLeft = 'Shift',
	ShiftRight = 'Shift',
	ControlLeft = 'Ctrl',
	MetaLeft = '❖',
	AltLeft = 'Alt',
	Space = ' ',
	AltRight = 'Alt',
	MetaRight = '❖',
	ContextMenu = '☰',
	ControlRight = 'Ctrl',

	Escape = 'Esc',

	Insert = 'Insert',
	Delete = 'Delete',
	Home = 'Home',
	End = 'End',
	PageUp = 'PgUp',
	PageDown = 'PgDn',

	ArrowUp = '⯅',
	ArrowDown = '⯆',
	ArrowLeft = '⯇',
	ArrowRight = '⯈',
}

const _modifierKeys = [
	'ShiftLeft',
	'ShiftRight',
	'ControlLeft',
	'ControlRight',
	'AltLeft',
	'AltRight',
	'MetaLeft',
	'MetaRight',
]

const knownGeneralizedModifiers = [
	MODIFIER_MAP.AltLeft,
	MODIFIER_MAP.ControlLeft,
	MODIFIER_MAP.MetaLeft,
	MODIFIER_MAP.ShiftLeft,
] as const

const COMBINATOR_RE = /\s*\+\s*/

function normalizeModifier(key: string) {
	return key === 'mod' ? (_isMacLike ? '❖' : 'ctrl') : key
}

function parseHotKey(hotkey: string) {
	return hotkey.toLowerCase().split(COMBINATOR_RE).map(normalizeModifier)
}

function normalizeHotKey(hotkey: string, sorensen: Sorensen) {
	let allKeys = parseHotKey(hotkey)

	const lastKey = allKeys.pop()!
	allKeys = allKeys.sort()
	allKeys.push(lastKey)
	const normalizedCombo = normalizeControl(keyLabelsToCodes(allKeys.join('+'), sorensen))

	return normalizedCombo
}

export function sortAndGeneralizeModifiers(keys: string) {
	const individualKeys = keys.split(/\+/gi)
	const generalizedKeys = convertToLenientModifiers(individualKeys)
	const finalKey = generalizedKeys.pop()
	const sortedModifiers = generalizedKeys.sort()
	return [...sortedModifiers, finalKey].join('+')
}

export function normalizeControl(keys: string) {
	return keys.replace('Ctrl', 'Control')
}

interface IKeyboardPreviewKeyProps {
	t: TFunction
	keyPosition: KeyPositon
	custom?: HotkeyDefinition
	mappedCombo: string
	override?: string
	modifierKey: string | undefined
	thisKeyLabel: string
	keyDown: boolean
	sourceLayerLookup: SourceLayerLookup
	onKeyClick: (e: any, mountedTriggers: Array<MountedAdLibTrigger | MountedGenericTrigger> | string) => void
	toggleModifierOnTouch: (modifier: string) => void
}

export const KeyboardPreviewKey: React.FC<IKeyboardPreviewKeyProps> = React.memo(function KeyboardPreviewKey(
	props: IKeyboardPreviewKeyProps
) {
	const keyCode = props.keyPosition.code

	const finalKeyTriggers = useTracker(() => {
		const generalizedKey = MODIFIER_MAP[keyCode]
		const keyQuery = generalizedKey ? { $regex: new RegExp(`^${keyCode}|${generalizedKey}$`) } : keyCode
		const adLibTriggers = MountedAdLibTriggers.find({
			finalKeys: keyQuery,
		}).fetch()
		const genericTriggers = MountedGenericTriggers.find({
			finalKeys: keyQuery,
			adLibOnly: { $ne: true },
			triggeredActionId: { $nin: adLibTriggers.map((trigger) => trigger.triggeredActionId) },
		}).fetch()
		const triggersByKeys = new Map<string, Array<MountedAdLibTrigger | MountedGenericTrigger>>()
		const insertTriggers = (triggers: Array<MountedAdLibTrigger | MountedGenericTrigger>) => {
			triggers.forEach((trigger) => {
				trigger.keys.forEach((keys) => {
					const finalKey = getFinalKey(keys)
					if (finalKey === keyCode || (generalizedKey && finalKey === generalizedKey)) {
						const keysWithSortedModifiers = sortAndGeneralizeModifiers(normalizeControl(keys))
						const trigersForThisKey = triggersByKeys.get(keysWithSortedModifiers)
						if (!trigersForThisKey) {
							triggersByKeys.set(keysWithSortedModifiers, [trigger])
						} else {
							trigersForThisKey.push(trigger)
						}
					}
				})
			})
		}
		insertTriggers(adLibTriggers)
		insertTriggers(genericTriggers)

		return triggersByKeys
	}, [keyCode])

	const comboTriggers = finalKeyTriggers?.get(sortAndGeneralizeModifiers(props.mappedCombo))
	const firstTarget = comboTriggers?.length && isMountedAdLibTrigger(comboTriggers[0]) && comboTriggers[0]
	return (
		<div
			className={ClassNames(
				'keyboard-preview__key',
				props.override || (!comboTriggers?.length && !props.custom)
					? undefined
					: props.custom?.buttonColor === undefined
					? props.custom?.sourceLayerType !== undefined
						? RundownUtils.getSourceLayerClassName(props.custom?.sourceLayerType)
						: firstTarget && firstTarget.sourceLayerId
						? RundownUtils.getSourceLayerClassName(props.sourceLayerLookup[firstTarget.sourceLayerId]?.type)
						: undefined
					: undefined,
				{
					'keyboard-preview__key--fill': props.keyPosition.width < 0,
					'keyboard-preview__key--down': props.keyDown,
				}
			)}
			style={{
				fontSize: props.keyPosition.width >= 0 ? (props.keyPosition.width || 1) + 'em' : undefined,
				backgroundColor: props.custom?.buttonColor,
			}}
			onClick={(e) =>
				props.custom && props.custom?.platformKey !== props.custom?.key
					? props.onKeyClick(e, props.custom.key)
					: comboTriggers?.length
					? props.onKeyClick(e, comboTriggers)
					: props.modifierKey && props.toggleModifierOnTouch(props.modifierKey)
			}
		>
			<div className="keyboard-preview__key__label">{props.thisKeyLabel}</div>
			<div className="keyboard-preview__key__function-label">
				{!props.override &&
					(props.custom?.label ||
						(!!comboTriggers?.length &&
							comboTriggers
								.map((func) => {
									const name = (isMountedAdLibTrigger(func) && func.targetName) || func.name
									return typeof name === 'string' ? name : name ? translateMessage(name, props.t) : ''
								})
								.join(', ')))}
			</div>
		</div>
	)
})

export const KeyboardPreview = translateWithTracker<IProps, IState, ITrackedProps>(
	(props: IProps) => {
		const customLabels: {
			[key: string]: HotkeyDefinition
		} = {}
		const hotkeyOverrides: {
			[key: string]: string
		} = {}
		const sourceLayerLookup = normalizeArray(props.showStyleBase && props.showStyleBase.sourceLayers, '_id')
		if (props.sorensen && props.showStyleBase && props.showStyleBase.hotkeyLegend) {
			props.showStyleBase.hotkeyLegend.forEach((hotkey) => {
				const normalizedKey = normalizeHotKey(hotkey.key, props.sorensen!)
				const normalizedPlatformKey = hotkey.platformKey && normalizeHotKey(hotkey.platformKey, props.sorensen!)
				hotkey.platformKey = normalizedPlatformKey
				hotkey.key = normalizedKey
				customLabels[normalizedPlatformKey || normalizedKey] = hotkey
				if (normalizedPlatformKey && normalizedKey !== normalizedPlatformKey) {
					hotkeyOverrides[normalizedKey] = normalizedPlatformKey
				}
			})
		}
		return { customLabels, sourceLayerLookup, hotkeyOverrides }
	},
	(_data, props, nextProps) => {
		return !_.isEqual(props, nextProps)
	}
)(
	class KeyboardPreview extends MeteorReactComponent<Translated<IProps> & ITrackedProps, IState> {
		constructor(props: IProps) {
			super(props)

			this.state = {
				layout: undefined,
				keyDown: {},
			}
		}

		onKeyUp = (e: KeyboardEvent) => {
			const keyDown = {}
			keyDown[e.code] = false

			if (this.state.keyDown[e.code] !== keyDown[e.code]) {
				this.setState({
					keyDown: Object.assign({}, this.state.keyDown, keyDown),
				})
			}
		}

		onKeyDown = (e: KeyboardEvent) => {
			const keyDown = {}
			keyDown[e.code] = true

			if (this.state.keyDown[e.code] !== keyDown[e.code]) {
				this.setState({
					keyDown: Object.assign({}, this.state.keyDown, keyDown),
				})
			}
		}

		onBlur = () => {
			this.setState({
				keyDown: {},
			})
		}

		onLayoutChange = async () => {
			if (navigator.keyboard) {
				await navigator.keyboard.getLayoutMap().then((layout) => this.setState({ layout }))
			}
		}

		onKeyClick = (e: any, mountedTriggersOrOverride: Array<MountedAdLibTrigger | MountedGenericTrigger> | string) => {
			if (typeof mountedTriggersOrOverride === 'string') {
				const overridingTrigger = mountedTriggersOrOverride
				const finalKey = getFinalKey(mountedTriggersOrOverride)
				const generalizedKey = MODIFIER_MAP[finalKey]
				const keyQuery = generalizedKey ? { $regex: new RegExp(`^${finalKey}|${generalizedKey}$`) } : finalKey
				const mountedTriggers = MountedGenericTriggers.find({ finalKeys: keyQuery }).fetch()
				mountedTriggersOrOverride = mountedTriggers.filter((trigger) => {
					return trigger.keys
						.map((key) => sortAndGeneralizeModifiers(normalizeControl(key)))
						.includes(overridingTrigger)
				})
			}
			mountedTriggersOrOverride.forEach((trigger) =>
				RundownViewEventBus.emit(RundownViewEvents.TRIGGER_ACTION, {
					context: e,
					actionId: trigger.triggeredActionId,
				})
			)
		}

		toggleModifierOnTouch = (modifier: string) => {
			const keyDown = {}
			keyDown[modifier] = !this.state.keyDown[modifier]

			this.setState({
				keyDown: Object.assign({}, this.state.keyDown, keyDown),
			})
		}

		componentDidMount() {
			if (navigator.keyboard) {
				navigator.keyboard
					.getLayoutMap()
					.then((layout) => this.setState({ layout }))
					.catch(() => {
						/* Do nothing */
					})
				if (navigator.keyboard.addEventListener) {
					navigator.keyboard.addEventListener('layoutchange', this.onLayoutChange)
				}
			}
			window.addEventListener('keydown', this.onKeyDown)
			window.addEventListener('keyup', this.onKeyUp)
			window.addEventListener('blur', this.onBlur)
		}

		componentWillUnmount() {
			if (navigator.keyboard && navigator.keyboard.removeEventListener) {
				navigator.keyboard.removeEventListener('layoutchange', this.onLayoutChange)
			}
			window.removeEventListener('keydown', this.onKeyDown)
			window.removeEventListener('keyup', this.onKeyUp)
			window.removeEventListener('blur', this.onBlur)
		}

		shouldComponentUpdate(nextProps: IProps & ITrackedProps, nextState: IState) {
			if (this.state !== nextState || !_.isEqual(nextProps, this.props)) {
				return true
			}
			return false
		}

		private renderBlock(block: KeyPositon[][], modifiers: string[]) {
			return block.map((row, index) => (
				<div className="keyboard-preview__key-row" key={index}>
					{row.map((key, index) => {
						if (key.code === SpecialKeyPositions.BLANK_SPACE) {
							return (
								<div
									key={'idx' + index}
									className={ClassNames('keyboard-preview__blank-space', {
										'keyboard-preview__blank-space--spring': key.width < 0,
									})}
									style={{ fontSize: key.width >= 0 ? (key.width || 1) + 'em' : undefined }}
								></div>
							)
						} else {
							let modifierKey: string | undefined

							let thisKeyLabel = this.state.layout
								? this.state.layout.get(key.code) || GenericFuncionalKeyLabels[key.code] || key.code
								: GenericFuncionalKeyLabels[key.code] || key.code

							if (_isMacLike && thisKeyLabel === '❖') {
								thisKeyLabel = '\u2318'
							}

							if (_modifierKeys.includes(key.code)) {
								modifierKey = key.code
							}

							const comboForSorensen = [...modifiers, key.code].join('+').trim()

							return (
								<KeyboardPreviewKey
									key={key.code}
									keyPosition={key}
									custom={this.props.customLabels[comboForSorensen]}
									override={this.props.hotkeyOverrides[comboForSorensen]}
									mappedCombo={comboForSorensen}
									modifierKey={modifierKey}
									thisKeyLabel={thisKeyLabel}
									keyDown={this.state.keyDown[key.code] === true}
									sourceLayerLookup={this.props.sourceLayerLookup}
									onKeyClick={this.onKeyClick}
									toggleModifierOnTouch={this.toggleModifierOnTouch}
									t={this.props.t}
								/>
							)
						}
					})}
				</div>
			))
		}

		render() {
			const { physicalLayout: keys } = this.props
			const alphanumericBlock = keys.slice(0, 5)
			const functionBlock = keys.slice(5, 6)
			const controlPad = keys.slice(6, 8)
			const arrowPad = keys.slice(8, 10)
			const numPad = keys.slice(10, 15)

			const currentModifiers = _.intersection(
				_.compact(_.map(this.state.keyDown, (value, key) => (value ? key : undefined))).map(
					(keyCode) => MODIFIER_MAP[keyCode]
				),
				knownGeneralizedModifiers
			).sort()

			return (
				<div className="keyboard-preview">
					{functionBlock.length > 0 && (
						<div className="keyboard-preview__function">{this.renderBlock(functionBlock, currentModifiers)}</div>
					)}
					{alphanumericBlock.length > 0 && (
						<div className="keyboard-preview__alphanumeric">
							{this.renderBlock(alphanumericBlock, currentModifiers)}
						</div>
					)}
					{controlPad.length > 0 && (
						<div className="keyboard-preview__control-pad">{this.renderBlock(controlPad, currentModifiers)}</div>
					)}
					{arrowPad.length > 0 && (
						<div className="keyboard-preview__arrow-pad">{this.renderBlock(arrowPad, currentModifiers)}</div>
					)}
					{numPad.length > 0 && (
						<div className="keyboard-preview__num-pad">{this.renderBlock(numPad, currentModifiers)}</div>
					)}
				</div>
			)
		}
	}
)

import { Mongo } from 'meteor/mongo'
import { ISourceLayer } from '@sofie-automation/blueprints-integration'
import { literal } from '../../lib/lib'

export enum HotkeyAssignmentType {
	SYSTEM = 'system',
	GLOBAL_ADLIB = 'global_adlib',
	ADLIB = 'adlib',
	CUSTOM_LABEL = 'custom_label',
	RUNTIME_ARGUMENT = 'runtime_argument',
}

export interface IHotkeyAssignment {
	combo: string
	label: string
	type: HotkeyAssignmentType
	sourceLayer: ISourceLayer | undefined
	eventHandler: (...args: any[]) => void
	eventHandlerArguments?: any[]
	willQueue?: boolean
}

interface IHotkeyAssignmentDB extends IHotkeyAssignment {
	_id: string
	tag: string | undefined
}

export const RegisteredHotkeys = new Mongo.Collection<IHotkeyAssignmentDB>(null as any)

export function registerHotkey(
	combo: string,
	label: string,
	type: HotkeyAssignmentType,
	sourceLayer: ISourceLayer | undefined,
	willQueue: boolean,
	eventHandler: (...args: any[]) => void,
	eventHandlerArguments?: any[],
	tag?: string
) {
	const id = combo + (tag ? '_' + tag : '')

	RegisteredHotkeys.upsert(
		id,
		literal<IHotkeyAssignmentDB>({
			_id: id,
			tag,
			combo,
			label,
			type,
			sourceLayer,
			willQueue,
			eventHandler,
			eventHandlerArguments,
		})
	)
}

window['RegisteredHotkeys'] = RegisteredHotkeys

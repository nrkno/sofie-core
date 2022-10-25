import {
	SomeBlueprintTrigger,
	IBlueprintHotkeyTrigger,
	TriggerType,
	IBlueprintDeviceTrigger,
} from '@sofie-automation/blueprints-integration'

export function isHotkeyTrigger(trigger: SomeBlueprintTrigger): trigger is IBlueprintHotkeyTrigger {
	if (trigger.type === TriggerType.hotkey) return true
	return false
}

export function isDeviceTrigger(trigger: SomeBlueprintTrigger): trigger is IBlueprintDeviceTrigger {
	if (trigger.type === TriggerType.device) return true
	return false
}

// Note: This file only contains typings exported from the casparcg-state library
import { CasparCG } from './api'

export interface TransitionObject {
	_value: string | number | boolean
	inTransition: Transition
	changeTransition: Transition
	outTransition: Transition
}
export interface Transition extends CasparCG.ITransition {
	type: string
	duration: number
	easing: string
	direction: string
}

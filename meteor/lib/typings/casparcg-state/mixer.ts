// Note: This file only contains typings exported from the casparcg-state library
import * as _ from 'underscore'
import { Enum as CCG_Enum } from '../casparcg-connection'
import { TransitionObject } from './transitionObject'
import { CasparCG } from './api'
export interface Mixer {

	inTransition?: CasparCG.ITransition
	changeTransition?: CasparCG.ITransition
	outTransition?: CasparCG.ITransition

	anchor?: {x: number, y: number } | TransitionObject
	blend?: CCG_Enum.BlendMode | TransitionObject
	brightness?: number | TransitionObject
	chroma?: {
		keyer: CCG_Enum.Chroma,
		threshold: number,
		softness: number,
		spill: number

	} | TransitionObject
	clip?: {x: number, y: number, width: number, height: number } | TransitionObject
	contrast?: number | TransitionObject
	crop?: {left: number, top: number, right: number, bottom: number } | TransitionObject
	fill?: {x: number, y: number, xScale: number, yScale: number } | TransitionObject
	// grid
	keyer?: boolean | TransitionObject
	levels?: {minInput: number, maxInput: number, gamma: number, minOutput: number, maxOutput: number} | TransitionObject
	mastervolume?: number | TransitionObject
	// mipmap
	opacity?: number | TransitionObject
	perspective?: {
		topLeftX: number,
		topLeftY: number,
		topRightX: number,
		topRightY: number,
		bottomRightX: number,
		bottomRightY: number,
		bottomLeftX: number,
		bottomLeftY: number
	} | TransitionObject

	rotation?: number | TransitionObject
	saturation?: number | TransitionObject
	straightAlpha?: boolean | TransitionObject
	volume?: number | TransitionObject

	bundleWithCommands?: number // special function: bundle and DEFER with other mixer-commands

}

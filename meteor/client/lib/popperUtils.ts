import { ModifierPhases } from '@popperjs/core'

export const sameWidth = {
	name: 'sameWidth',
	enabled: true,
	phase: 'beforeWrite' as ModifierPhases,
	requires: ['computeStyles'],
	fn: ({ state }: { state: any }): void => {
		const targetWidth = Math.max(208, state.rects.reference.width + 10)
		state.styles.popper.width = `${targetWidth}px`
		state.styles.popper.transform = `translate(${
			state.rects.reference.x - 10 + (state.rects.reference.width + 10 - targetWidth) / 2
		}px, ${Math.ceil(state.modifiersData.popperOffsets.y)}px)`
	},
	effect: ({ state }: { state: any }): void => {
		state.elements.popper.style.width = `${state.elements.reference.offsetWidth + 10}px`
	},
}

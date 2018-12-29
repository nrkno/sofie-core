import * as React from 'react'
import * as $ from 'jquery'
import * as _ from 'underscore'
import { PrompterViewInner } from '../PrompterView'

export const LONGPRESS_TIME = 500

export abstract class ControllerAbstract {

	private _view: PrompterViewInner
	constructor (view: PrompterViewInner) {
		this._view = view

	}
	public abstract destroy (): void
	public abstract onKeyDown (e: KeyboardEvent): void
	public abstract onKeyUp (e: KeyboardEvent): void
	public abstract onMouseKeyDown (e: MouseEvent): void
	public abstract onMouseKeyUp (e: MouseEvent): void
	public abstract onWheel (e: WheelEvent): void

	protected findAnchorPosition (startY: number, endY: number, sortDirection: number = 1): number | null {
		let foundPositions: number[] = []
		_.find($('.prompter .scroll-anchor'), el => {
			const offset = $(el).offset()
			if (
				offset &&
				( startY === -1 || offset.top > startY ) &&
				( endY === -1 	|| offset.top <= endY )
			) {
				foundPositions.push(offset.top)
				return true
			}
		})
		foundPositions = _.sortBy(foundPositions, v => sortDirection * v)

		return foundPositions[0] || null
	}
	protected getScrollPosition () {
		return window.scrollY || window.pageYOffset || (document.documentElement || {scrollTop: undefined}).scrollTop
	}

}

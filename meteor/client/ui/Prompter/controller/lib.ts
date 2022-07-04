import { PrompterViewInner } from '../PrompterView'

export const LONGPRESS_TIME = 500

export abstract class ControllerAbstract {
	constructor(_view: PrompterViewInner) {}
	public abstract destroy(): void
	public abstract onKeyDown(e: KeyboardEvent): void
	public abstract onKeyUp(e: KeyboardEvent): void
	public abstract onMouseKeyDown(e: MouseEvent): void
	public abstract onMouseKeyUp(e: MouseEvent): void
	public abstract onWheel(e: WheelEvent): void
}

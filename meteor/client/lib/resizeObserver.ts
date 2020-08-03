declare global {
	interface IObserveOptions {
		box: 'content-box' | 'border-box'
	}

	interface ResizeObserverEntry {
		contentBoxSize?: DOMRectReadOnly
		borderBoxSize?: DOMRectReadOnly
		contentRect?: DOMRectReadOnly
		target?: HTMLElement
	}

	class ResizeObserver {
		constructor(clb: (entries: ResizeObserverEntry[], observer: ResizeObserver) => void)
		/** Make the observer observe changes to the size of the element */
		observe(target: HTMLElement, options?: IObserveOptions): void
		/** Remove all observed elements */
		disconnect(): void
		/** Remove a single element from the observed collection */
		unobserve(target: HTMLElement): void
	}
}

export function onElementResize(
	el: HTMLElement,
	clb: (entries: ResizeObserverEntry[], observer: ResizeObserver) => void
) {
	const resizeObserver = new ResizeObserver(clb)
	resizeObserver.observe(el)
	return resizeObserver
}

export function offElementResize(resizeObserver: ResizeObserver, el: HTMLElement) {
	resizeObserver.unobserve(el)
}

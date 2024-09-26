import React from 'react'

type VirtualElement = {
	getBoundingClientRect: () => DOMRect
	contextElement?: Element
}

export type PreviewContent =
	| {
			type: 'iframe'
			href: string
			awaitMessage?: any
			postMessage?: any
	  }
	| {
			type: 'image'
			src: string
	  }
	| {
			type: 'video'
			src: string
			currentTime: number
	  }
	| {
			type: 'text'
			content: string
	  }

interface IPreviewPopUpContext {
	display: (
		anchor: HTMLElement | VirtualElement,
		content: PreviewContent,
		opts?: {
			size?: 'small' | 'large'
			controls?: React.ReactNode
			contentInfo?: React.ReactNode
			warnings?: React.ReactNode
		}
	) => void
	hide: () => void
}

const PreviewPopUpContext = React.createContext<IPreviewPopUpContext>({
	display: () => void {},
	hide: () => void {},
})

export function PreviewPopUpContextProvider({ children }: React.PropsWithChildren<{}>): React.ReactNode {
	const context: IPreviewPopUpContext = {
		display: () => void {},
		hide: () => void {},
	}

	return <PreviewPopUpContext.Provider value={context}>{children}</PreviewPopUpContext.Provider>
}

import React, { useRef, useState } from 'react'

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

interface IPreviewPopUpHandle {
	update: Readonly<(content?: PreviewContent) => void>
	close: Readonly<() => void>
	onClosed?: () => void
}

interface IPreviewPopUpContext {
	requestPreview(
		anchor: HTMLElement | VirtualElement,
		content: PreviewContent,
		opts?: {
			size?: 'small' | 'large'
			controls?: React.ReactNode
			contentInfo?: React.ReactNode
			warnings?: React.ReactNode
		}
	): IPreviewPopUpHandle
}

const PreviewPopUpContext = React.createContext<IPreviewPopUpContext>({
	requestPreview: () => {
		throw new Error('Preview PopUp needs to set up with `PreviewPopUpContextProvider`.')
	},
})

export function PreviewPopUpContextProvider({ children }: React.PropsWithChildren<{}>): React.ReactNode {
	const [isVisible, setVisible] = useState(false)
	const [currentHandle, setCurrentHandle] = useRef()

	const context: IPreviewPopUpContext = {
		requestPreview: (anchor, content, opts) => {
			setVisible(true)

			const handle: IPreviewPopUpHandle = {
				close: () => {
					setVisible(false)
				},
				update: () => {
					// todo test
				},
			}

			return handle
		},
	}

	return <PreviewPopUpContext.Provider value={context}>{children}</PreviewPopUpContext.Provider>
}

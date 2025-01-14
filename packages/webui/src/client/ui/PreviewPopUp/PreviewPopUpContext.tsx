import React, { useRef, useState } from 'react'
import { PreviewPopUp, PreviewPopUpHandle } from './PreviewPopUp'
import { Padding, Placement } from '@popperjs/core'
import { PreviewPopUpContent } from './PreviewPopUpContent'

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
	| {
			type: 'boxLayout'
			content: unknown
	  }

export interface IPreviewPopUpSession {
	/**
	 * Update the open preview with new content or modify the content already being previewed, such as change current showing
	 * time in the video, etc.
	 */
	readonly update: (content?: PreviewContent) => void
	/**
	 * Close the preview
	 */
	readonly close: () => void
	/**
	 * Callback for when the preview session is closed by using close() or another preview starting
	 */
	onClosed?: () => void
}

interface PreviewRequestOptions {
	/** Padding to be used for placing the Preview PopUp around the anchor element */
	padding?: Padding
	/** Where to place the Preview popUp around the anchor element */
	placement?: Placement
	/** Which  size of the preview to use. Will default to small. */
	size?: 'small' | 'large'
	/** Show additional controls underneath the preview content area */
	controls?: React.ReactNode
	/** Additional content information that's not part of the preview */
	contentInfo?: React.ReactNode
	/** Warnings for the content being previewed */
	warnings?: React.ReactNode[]
}

interface IPreviewPopUpContext {
	/**
	 * Request a new preview session
	 * @param anchor The HTML element the preview
	 * @param content The description of what is to be previewed
	 * @param opts
	 */
	requestPreview(
		anchor: HTMLElement | VirtualElement,
		content: PreviewContent,
		opts?: PreviewRequestOptions
	): IPreviewPopUpSession
}

export const PreviewPopUpContext = React.createContext<IPreviewPopUpContext>({
	requestPreview: () => {
		throw new Error('Preview PopUp needs to set up with `PreviewPopUpContextProvider`.')
	},
})

interface PreviewSession {
	anchor: HTMLElement | VirtualElement
	padding: Padding
	placement: Placement
	size: 'small' | 'large'
	/** Show additional controls underneath the preview content area */
	controls?: React.ReactNode
	/** Additional content information that's not part of the preview */
	contentInfo?: React.ReactNode
	/** Warnings for the content being previewed */
	warnings?: React.ReactNode[]
}

export function PreviewPopUpContextProvider({ children }: React.PropsWithChildren<{}>): React.ReactNode {
	const currentHandle = useRef<IPreviewPopUpSession>()
	const previewRef = useRef<PreviewPopUpHandle>(null)

	const [previewSession, setPreviewSession] = useState<PreviewSession | null>(null)
	const [previewContent, setPreviewContent] = useState<PreviewContent | null>(null)

	const context: IPreviewPopUpContext = {
		requestPreview: (anchor, content, opts) => {
			setPreviewSession({
				anchor,
				padding: opts?.padding ?? 0,
				placement: opts?.placement ?? 'top',
				size: opts?.size ?? 'small',
				controls: opts?.controls,
				contentInfo: opts?.contentInfo,
				warnings: opts?.warnings,
			})
			setPreviewContent(content)

			const handle: IPreviewPopUpSession = {
				close: () => {
					setPreviewSession(null)
				},
				update: () => {
					previewRef.current?.update()
				},
			}
			currentHandle.current = handle

			return handle
		},
	}

	return (
		<PreviewPopUpContext.Provider value={context}>
			{children}
			{previewSession && (
				<PreviewPopUp
					ref={previewRef}
					anchor={previewSession.anchor}
					padding={previewSession.padding}
					size={previewSession.size}
					placement={previewSession.placement}
					contentInfo={previewSession.contentInfo}
					controls={previewSession.controls}
					warnings={previewSession.warnings}
				>
					{previewContent && <PreviewPopUpContent content={previewContent} />}
				</PreviewPopUp>
			)}
		</PreviewPopUpContext.Provider>
	)
}

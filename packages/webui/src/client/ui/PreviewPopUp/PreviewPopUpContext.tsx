import React, { useRef, useState } from 'react'
import { PreviewPopUp, PreviewPopUpHandle } from './PreviewPopUp'
import { Padding, Placement } from '@popperjs/core'
import { PreviewPopUpContent } from './PreviewPopUpContent'
import {
	Previews,
	PreviewType,
	ScriptContent,
	SourceLayerType,
	SplitsContent,
	SplitsContentBoxContent,
	SplitsContentBoxProperties,
	VTContent,
} from '@sofie-automation/blueprints-integration'
import { ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { PieceContentStatusObj } from '@sofie-automation/meteor-lib/dist/api/pieceContentStatus'
import { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import { PieceUi } from '../SegmentContainer/withResolvedSegment'
import _ from 'underscore'
import { IAdLibListItem } from '../Shelf/AdLibListItem'
import { PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'

type VirtualElement = {
	getBoundingClientRect: () => DOMRect
	contextElement?: Element
}

export function convertPreviewToContents(
	content: Previews | ReadonlyObjectDeep<Previews>,
	contentStatus?: ReadonlyObjectDeep<PieceContentStatusObj>
): PreviewContent[] {
	switch (content.type) {
		case PreviewType.Script:
			return [
				{
					type: 'script',
					content: content.fullText ?? content.lastWords ?? content.comment ?? 'No text found', // note - translate here?
				},
			]
		case PreviewType.VT: {
			if (contentStatus?.previewUrl) {
				return [
					{ type: 'title', content: 'VT Todo' },
					{
						type: 'video',
						src: contentStatus?.previewUrl,
					},
				]
			} else {
				return [
					{
						type: 'warning',
						content: { key: 'No preview url found' },
					},
				]
			}
		}
		default:
			return [
				{
					type: 'warning',
					content: { key: 'No preview type found' },
				},
			]
	}
}

export function convertSourceLayerItemToPreview(
	sourceLayerType: SourceLayerType,
	item: ReadonlyObjectDeep<PieceInstancePiece> | IAdLibListItem,
	contentStatus?: ReadonlyObjectDeep<PieceContentStatusObj>
): PreviewContent[] {
	if (sourceLayerType === SourceLayerType.VT || sourceLayerType === SourceLayerType.LIVE_SPEAK) {
		const content = item.content as VTContent

		return _.compact([
			{
				type: 'title',
				content: content.fileName,
			},
			contentStatus?.previewUrl && {
				type: 'video',
				src: contentStatus.previewUrl,
			},
			{
				type: 'inOutWords',
				in: 'This is a sentence of words for the inpoint',
				out: 'these words mark the outpoint of the VT',
			},
			...(contentStatus?.messages?.map<PreviewContent>((m) => ({
				type: 'warning',
				content: m as any,
			})) || []),
		])
	} else if (sourceLayerType === SourceLayerType.GRAPHICS) {
		return [
			{
				type: 'title',
				content: item.name,
			},
			// {
			// 	type: 'data',
			// 	content: { exampleField: 'exampleValue' }, // todo - take data from actual templateData
			// },
			{
				type: 'iframe',
				href: 'http://localhost:3005/dev/templatePreview.html',
				postMessage: {
					event: 'sofie-update',
					payload: item.name,
				},
			},
		]
	} else if (sourceLayerType === SourceLayerType.SCRIPT) {
		const content = item.content as ScriptContent
		return [
			{
				type: 'script',
				script: content.fullScript,
				lastWords: content.lastWords,
				comment: content.comment,
				lastModified: content.lastModified ?? undefined,
			},
		]
	} else if (sourceLayerType === SourceLayerType.SPLITS) {
		const content = item.content as SplitsContent
		return [{ type: 'boxLayout', boxSourceConfiguration: content.boxSourceConfiguration }]
	}

	return []
}

export type PreviewContent =
	| {
			type: 'iframe'
			href: string
			postMessage?: any
	  }
	| {
			type: 'image'
			src: string
	  }
	| {
			type: 'video'
			src: string
	  }
	| {
			type: 'script'
			script?: string
			lastWords?: string
			comment?: string
			lastModified?: number
	  }
	| {
			type: 'title'
			content: string
	  }
	| {
			type: 'inOutWords'
			in?: string
			out: string
	  }
	| {
			type: 'data'
			content: Record<string, string>
	  }
	| {
			type: 'boxLayout'
			boxSourceConfiguration: (SplitsContentBoxContent & SplitsContentBoxProperties)[]
			showLabels?: boolean
			backgroundArt?: string
	  }
	| {
			type: 'warning'
			content: ITranslatableMessage
	  }
	| {
			type: 'stepCount'
			current: number
			total?: number
	  }

export interface IPreviewPopUpSession {
	/**
	 * Update the open preview with new content or modify the content already being previewed, such as change current showing
	 * time in the video, etc.
	 */
	readonly update: (content?: PreviewContent[]) => void
	/** */
	readonly setPointerTime: (t: number) => void
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
	/** Set this to the time the pointer is  */
	time?: number
	/**  */
	startCoordinate?: number
	/** */
	trackMouse?: boolean
}

export interface IPreviewPopUpContext {
	/**
	 * Request a new preview session
	 * @param anchor The HTML element the preview
	 * @param content The description of what is to be previewed
	 * @param opts
	 */
	requestPreview(
		anchor: HTMLElement | VirtualElement,
		content: PreviewContent[],
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
	startCoordinate?: number
	trackMouse?: boolean
}

export function PreviewPopUpContextProvider({ children }: React.PropsWithChildren<{}>): React.ReactNode {
	const currentHandle = useRef<IPreviewPopUpSession>()
	const previewRef = useRef<PreviewPopUpHandle>(null)

	const [previewSession, setPreviewSession] = useState<PreviewSession | null>(null)
	const [previewContent, setPreviewContent] = useState<PreviewContent[] | null>(null)
	const [t, setTime] = useState<number | null>(null)

	const context: IPreviewPopUpContext = {
		requestPreview: (anchor, content, opts) => {
			if (opts?.time) {
				setTime(opts.time)
			} else {
				setTime(null)
			}
			setPreviewSession({
				anchor,
				padding: opts?.padding ?? 0,
				placement: opts?.placement ?? 'top',
				size: opts?.size ?? 'small',
				startCoordinate: opts?.startCoordinate,
				trackMouse: opts?.trackMouse,
			})
			setPreviewContent(content)

			const handle: IPreviewPopUpSession = {
				close: () => {
					setPreviewSession(null)
				},
				update: (contents) => {
					if (contents) {
						setPreviewContent(contents)
					}
					previewRef.current?.update()
				},
				setPointerTime: (t) => {
					setTime(t)
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
					startCoordinate={previewSession.startCoordinate}
					trackMouse={previewSession.trackMouse}
				>
					{previewContent && previewContent.map((content) => <PreviewPopUpContent time={t} content={content} />)}
				</PreviewPopUp>
			)}
		</PreviewPopUpContext.Provider>
	)
}

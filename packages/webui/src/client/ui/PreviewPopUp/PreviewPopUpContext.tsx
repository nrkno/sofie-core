import React, { useRef, useState } from 'react'
import { PreviewPopUp, PreviewPopUpHandle } from './PreviewPopUp'
import { Padding, Placement } from '@popperjs/core'
import { PreviewPopUpContent } from './PreviewPopUpContent'
import {
	JSONBlobParse,
	NoraPayload,
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
import _ from 'underscore'
import { IAdLibListItem } from '../Shelf/AdLibListItem'
import { PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'

type VirtualElement = {
	getBoundingClientRect: () => DOMRect
	contextElement?: Element
}

export function convertSourceLayerItemToPreview(
	sourceLayerType: SourceLayerType | undefined,
	item: ReadonlyObjectDeep<PieceInstancePiece> | IAdLibListItem,
	contentStatus?: ReadonlyObjectDeep<PieceContentStatusObj>
): PreviewContent[] {
	// first try to read the popup preview
	if (item.content.popUpPreview) {
		const popupPreview = item.content.popUpPreview
		const contents: PreviewContent[] = []

		if (popupPreview.name) {
			contents.push({ type: 'title', content: popupPreview.name })
		}

		if (popupPreview.preview) {
			switch (popupPreview.preview.type) {
				case PreviewType.BlueprintImage:
					contents.push({ type: 'image', src: '/api/private/blueprints/assets/' + popupPreview.preview.image })
					break
				case PreviewType.HTML:
					contents.push({
						type: 'iframe',
						href: popupPreview.preview.previewUrl,
						postMessage: popupPreview.preview.postMessageOnLoad,
					})
					if (popupPreview.preview.steps) {
						contents.push({
							type: 'stepCount',
							current: popupPreview.preview.steps.current,
							total: popupPreview.preview.steps.total,
						})
					}
					break
				case PreviewType.Script:
					contents.push({
						type: 'script',
						script: popupPreview.preview.fullText,
						lastWords: popupPreview.preview.lastWords,
						comment: popupPreview.preview.comment,
						lastModified: popupPreview.preview.lastModified,
					})
					break
				case PreviewType.Split:
					contents.push({
						type: 'boxLayout',
						boxSourceConfiguration: popupPreview.preview.boxes,
						backgroundArt: popupPreview.preview.background,
					})
					break
				case PreviewType.Table:
					contents.push({
						type: 'data',
						content: [...popupPreview.preview.entries],
					})
					break
				case PreviewType.VT:
					if (contentStatus?.previewUrl) {
						contents.push({
							type: 'video',
							src: contentStatus?.previewUrl,
						})
					} else if (contentStatus?.thumbnailUrl) {
						contents.push({
							type: 'image',
							src: contentStatus.thumbnailUrl,
						})
					}
					if (popupPreview.preview.outWords) {
						contents.push({
							type: 'inOutWords',
							in: popupPreview.preview.inWords,
							out: popupPreview.preview.outWords,
						})
					}
					break
			}
		}

		if (popupPreview.warnings) {
			contents.push(...popupPreview.warnings.map((w): PreviewContent => ({ type: 'warning', content: w.reason })))
		}

		return contents
	}

	// if no preview was specified, we try to infer one based on the source layer
	if (!sourceLayerType) return []

	if (sourceLayerType === SourceLayerType.VT || sourceLayerType === SourceLayerType.LIVE_SPEAK) {
		const content = item.content as VTContent

		return _.compact<(PreviewContent | undefined)[]>([
			{
				type: 'title',
				content: content.fileName,
			},
			contentStatus?.previewUrl
				? {
						type: 'video',
						src: contentStatus.previewUrl,
				  }
				: contentStatus?.thumbnailUrl
				? {
						type: 'image',
						src: contentStatus.thumbnailUrl,
				  }
				: undefined,
			// todo - add in-out words after rebasing
			...(contentStatus?.messages?.map<PreviewContent>((m) => ({
				type: 'warning',
				content: m as any,
			})) || []),
		]) as PreviewContent[]
	} else if (sourceLayerType === SourceLayerType.GRAPHICS && 'previewPayload' in item.content) {
		const payload = JSONBlobParse<NoraPayload>(item.content.previewPayload)
		const tableProps = Object.entries(payload.content)
			.filter(([key, value]) => !(key.startsWith('_') || key.startsWith('@') || value === ''))
			.map(([key, value]) => ({ key, value }))

		return _.compact([
			{
				type: 'title',
				content: payload.template.name ?? item.name, // todo - subtitle with variant
			},
			item.content.previewRenderer
				? {
						type: 'iframe',
						href: item.content.previewRenderer,
						postMessage: {
							event: 'nora',
							contentToShow: {
								manifest: payload.manifest,
								template: {
									event: 'preview',
									name: payload.template.name,
									channel: 'gfx1',
									layer: payload.template.layer,
									system: 'html',
								},
								content: {
									...payload.content,
									_valid: false,
								},
								timing: {
									duration: '00:05',
									in: 'auto',
									out: 'auto',
									timeIn: '00:00',
								},
								step: payload.step,
							},
						},
				  }
				: {
						type: 'data',
						content: tableProps,
				  },
			item.content.step && {
				type: 'stepCount',
				current: item.content.step.current,
				count: item.content.step.count,
			},
		]) as PreviewContent[]
	} else if (sourceLayerType === SourceLayerType.GRAPHICS) {
		return [
			{
				type: 'title',
				content: item.name,
			},
			// todo - item inpoint and duration
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
			dimensions?: { width: number; height: number }
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
			content: { key: string; value: string }[]
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

import React, { useEffect, useRef, useState } from 'react'
import { PreviewPopUp, PreviewPopUpHandle } from './PreviewPopUp.js'
import { Padding, Placement } from '@popperjs/core'
import { PreviewPopUpContent } from './PreviewPopUpContent.js'
import {
	JSONBlobParse,
	NoraPayload,
	PieceLifespan,
	PreviewType,
	ScriptContent,
	SourceLayerType,
	SplitsContent,
	SplitsContentBoxContent,
	SplitsContentBoxProperties,
	TransitionContent,
	VTContent,
} from '@sofie-automation/blueprints-integration'
import { ReadonlyDeep, ReadonlyObjectDeep } from 'type-fest/source/readonly-deep'
import { PieceContentStatusObj } from '@sofie-automation/corelib/dist/dataModel/PieceContentStatus'
import { ITranslatableMessage } from '@sofie-automation/corelib/dist/TranslatableMessage'
import _ from 'underscore'
import { IAdLibListItem } from '../Shelf/AdLibListItem.js'
import { PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { createPrivateApiPath } from '../../url.js'

type VirtualElement = {
	getBoundingClientRect: () => DOMRect
	contextElement?: Element
}

export function convertSourceLayerItemToPreview(
	sourceLayerType: SourceLayerType | undefined,
	item: ReadonlyObjectDeep<PieceInstancePiece> | IAdLibListItem,
	contentStatus?: ReadonlyObjectDeep<PieceContentStatusObj>,
	timeAsRendered?: { in?: number | null; dur?: number | null }
): { contents: PreviewContent[]; options: Readonly<Partial<PreviewRequestOptions>> } {
	// first try to read the popup preview
	if (item.content.popUpPreview) {
		const popupPreview = item.content.popUpPreview
		const contents: PreviewContent[] = []
		const options: Partial<PreviewRequestOptions> = {}

		if (popupPreview.name) {
			contents.push({ type: 'title', content: popupPreview.name })
		}

		if (popupPreview.preview) {
			switch (popupPreview.preview.type) {
				case PreviewType.BlueprintImage:
					contents.push({
						type: 'image',
						src: createPrivateApiPath('/blueprints/assets/' + popupPreview.preview.image),
					})
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
					options.size = 'large'
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
						backgroundArtSrc: createPrivateApiPath('/blueprints/assets/' + popupPreview.preview.background),
					})
					break
				case PreviewType.Table:
					contents.push({
						type: 'data',
						content: [...popupPreview.preview.entries],
					})
					if (popupPreview.preview.displayTiming) {
						contents.push({
							type: 'timing',
							timeAsRendered,
							enable: 'enable' in item ? item.enable : undefined,
							lifespan: item.lifespan,
						})
					}
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

		return { contents, options }
	}

	// if no preview was specified, we try to infer one based on the source layer
	if (!sourceLayerType) return { contents: [], options: {} }

	if (sourceLayerType === SourceLayerType.VT || sourceLayerType === SourceLayerType.LIVE_SPEAK) {
		const content = item.content as VTContent

		return {
			contents: _.compact<(PreviewContent | undefined)[]>([
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
				content.lastWords
					? {
							type: 'inOutWords',
							in: content.firstWords,
							out: content.lastWords,
						}
					: undefined,
				...(contentStatus?.messages?.map<PreviewContent>((m) => ({
					type: 'warning',
					content: m as any,
				})) || []),
			]) as PreviewContent[],
			options: {},
		}
	} else if (
		(sourceLayerType === SourceLayerType.GRAPHICS || sourceLayerType === SourceLayerType.LOWER_THIRD) &&
		'previewPayload' in item.content
	) {
		try {
			const payload = JSONBlobParse<NoraPayload>(item.content.previewPayload)
			const tableProps = payload.content
				? Object.entries<unknown>(payload.content)
						.filter(([key, value]) => !(key.startsWith('_') || key.startsWith('@') || value === ''))
						.map(([key, value]) => ({ key, value }))
				: []

			return {
				contents: _.compact([
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
				]) as PreviewContent[],
				options: { size: 'large' },
			}
		} catch (e) {
			console.error(`Failed to generate preview PopUp payload:`, e, item.content.previewPayload)

			return {
				contents: _.compact([
					{
						type: 'title',
						content: item.name,
					},
					item.content.step && {
						type: 'stepCount',
						current: item.content.step.current,
						count: item.content.step.count,
					},
				]) as PreviewContent[],
				options: {},
			}
		}
	} else if (sourceLayerType === SourceLayerType.GRAPHICS) {
		return {
			contents: [
				{
					type: 'title',
					content: item.name,
				},
				// note - this may have contained some NORA data before but idk the details on how to add that back
				{
					type: 'timing',
					timeAsRendered,
					enable: 'enable' in item ? item.enable : undefined,
					lifespan: item.lifespan,
				},
			],
			options: {},
		}
	} else if (sourceLayerType === SourceLayerType.SCRIPT) {
		const content = item.content as ScriptContent
		return {
			contents: [
				{
					type: 'script',
					script: content.fullScript,
					lastWords: content.lastWords,
					comment: content.comment,
					lastModified: content.lastModified ?? undefined,
				},
			],
			options: {},
		}
	} else if (sourceLayerType === SourceLayerType.SPLITS) {
		const content = item.content as SplitsContent
		return { contents: [{ type: 'boxLayout', boxSourceConfiguration: content.boxSourceConfiguration }], options: {} }
	} else if (sourceLayerType === SourceLayerType.TRANSITION) {
		const content = item.content as TransitionContent
		if (content.preview)
			return {
				contents: [{ type: 'image', src: createPrivateApiPath('/blueprints/assets/' + content.preview) }],
				options: {},
			}
	}

	return { contents: [], options: {} }
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
			boxSourceConfiguration: ReadonlyDeep<(SplitsContentBoxContent & SplitsContentBoxProperties)[]>
			showLabels?: boolean
			backgroundArtSrc?: string
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
	| {
			type: 'timing'
			timeAsRendered?: { in?: number | null; dur?: number | null }
			enable?: ReadonlyObjectDeep<PieceInstancePiece>['enable']
			lifespan: PieceLifespan
	  }

export interface IPreviewPopUpSession {
	/**
	 * Update the open preview with new content or modify the content already being previewed, such as change current showing
	 * time in the video, etc.
	 */
	readonly update: (content?: PreviewContent[]) => void
	/**
	 * Set the time that the current pointer position is representing in the scope of the preview contents
	 */
	readonly setPointerTime: (time: number) => void
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
	/** The initial X offset of the preview (in viewport coordinates) */
	initialOffsetX?: number
	/** If enabled, the preview will follow the cursor, until closed */
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
	initialOffsetX?: number
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
				initialOffsetX: opts?.initialOffsetX,
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

	useEffect(() => {
		console.log(previewSession)
	}, [previewSession])

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
					initialOffsetX={previewSession.initialOffsetX}
					trackMouse={previewSession.trackMouse}
				>
					{previewContent &&
						previewContent.map((content, i) => <PreviewPopUpContent key={i} time={t} content={content} />)}
				</PreviewPopUp>
			)}
		</PreviewPopUpContext.Provider>
	)
}

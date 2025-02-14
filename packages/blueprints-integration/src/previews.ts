import { NoteSeverity } from './lib'

export type Previews =
	| InvalidPreview
	| TablePreview
	| ScriptPreview
	| HTMLPreview
	| SplitPreview
	| VTPreview
	| BlueprintImagePreview

export enum PreviewType {
	Invalid = 'invalid',
	Table = 'table',
	Script = 'script',
	HTML = 'html',
	Split = 'split',
	VT = 'vt',
	BlueprintImage = 'blueprintImage',
}

interface PreviewBase {
	type: PreviewType
}

export interface InvalidPreview extends PreviewBase {
	// todo - is this required or would we just pull this from the piece warning anyway
	type: PreviewType.Invalid

	severity: NoteSeverity
	reason: string // todo - translate
}
export interface TablePreview extends PreviewBase {
	// todo - translations
	type: PreviewType.Table

	heading: string
	subheading?: string
	entries: { key: string; value: string }[]
}
export interface ScriptPreview extends PreviewBase {
	type: PreviewType.Script

	fullText?: string
	lastWords?: string
	comment?: string
	lastModified?: number
}
export interface HTMLPreview extends PreviewBase {
	// todo - steps and how to control them
	type: PreviewType.HTML

	previewUrl: string

	previewDimension?: { width: number; height: number }
	hasSteps?: boolean

	postMessageOnLoad?: any
}
export interface SplitPreview extends PreviewBase {
	type: PreviewType.Split

	background?: string // file asset upload?
	boxes: any // todo
}
export interface VTPreview extends PreviewBase {
	type: PreviewType.VT

	// note: the info required for the preview follows from package manager so there's nothing for blueprins here
	// note: if we want to allow a preview for different media than saved on the piece (because perhaps the media is in a non-primary piece) should we allow to specifiy the package to preview?
	// todo - turn this into a "PackagePreview"?
}
export interface BlueprintImagePreview extends PreviewBase {
	type: PreviewType.BlueprintImage

	image?: string // to be put in as asset
}

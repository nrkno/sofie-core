import { ConfigManifestEntry } from './config'
import { SomeContent } from './content'

export interface ActionUserData {
	[key: string]: any
}

export interface IBlueprintActionManifestDisplay {
	label: string
	description?: string
	_rank?: number

	tags?: string[]
	/** Piece tags to use to determine if action is currently active */
	currentPieceTags?: string[]
	/** Piece tags to use to determine if action is set as next */
	nextPieceTags?: string[]
}

export interface IBlueprintActionManifestDisplayContent extends IBlueprintActionManifestDisplay {
	/** Source layer the timeline item belongs to */
	sourceLayerId: string
	/** Layer output this piece belongs to */
	outputLayerId: string
	/** Description used to produce the thumbnail, sourceDuration, etc. information for the adlib */
	content?: Omit<SomeContent, 'timelineObjects'>
}

export interface IBlueprintActionManifest {
	/** Id of the action */
	actionId: string
	/** Properties defining the action behaviour */
	userData: ActionUserData

	/** Set if ad-lib action should be limited in context to the current part/segment */
	partId?: string

	userDataManifest: {
		/** List of editable fields in userData, to allow for customising */
		editableFields?: ConfigManifestEntry[]
		// Example future options:
		// callActionrightAfterEdit: boolean,
		// asloDisplayACtionButton: boolean
	}

	display: IBlueprintActionManifestDisplay | IBlueprintActionManifestDisplayContent
}

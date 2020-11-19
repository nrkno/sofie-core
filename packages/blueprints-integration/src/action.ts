import { ConfigManifestEntry } from './config'
import { SomeContent } from './content'

export interface ActionUserData {
	[key: string]: any
}

export enum ActionWorksOn {
	/** AdLib action operates on the current part */
	currentPart = 'currentPart',
	/** AdLib action operates on the next part */
	nextPart = 'nextPart',
	/** AdLib action may operate on the current or next part, depending on current part's contents */
	currentOrNextPart = 'currentOrNextPart',
	/** AdLib action queues a new part and sets it as next */
	queuesPart = 'queuesNewPart',
	/** AdLib action may queue a new part or operate on the next part, depending on next part's contents */
	queuesOrNextPart = 'queuesOrNextPart',
}

export enum ActionExecuteAfterChanged {
	/** Do not execute the action after userData has changed, unless specifically triggered by the user */
	none = 'none',
	/** Execute the action immediately after userData has changed */
	immediately = 'immediately',
	/** Execute the action after userData has changed and there was an identifiable period of calm in the changes */
	debounce = 'debounce',
}

export interface IBlueprintActionManifestDisplay {
	/** A label to be displayed to the user */
	label: string
	/** An optional, longer description that will not be immediately visible to the user */
	description?: string
	_rank?: number

	/** A flag, indicating if the action operates on the On Air/Current Part or if it operates on the Next Part/Queues a new Part. If not present, ActionWorksOn.currentPart is assumed. */
	worksOn?: ActionWorksOn

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
		/** Execute the action after userData is changed. If not present ActionExecuteAfterChanged.none is assumed. */
		executeOnUserDataChanged?: ActionExecuteAfterChanged
		// Potential future properties:
		// asloDisplayACtionButton: boolean
	}

	display: IBlueprintActionManifestDisplay | IBlueprintActionManifestDisplayContent
}

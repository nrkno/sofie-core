import { IBlueprintPart, NoteSeverity } from '@sofie-automation/blueprints-integration'
import { ITranslatableMessage } from '../TranslatableMessage'
import { PartId, RundownId, SegmentId } from './Ids'
import { PartNote } from './Notes'
import { ReadonlyDeep } from 'type-fest'

export interface PartInvalidReason {
	message: ITranslatableMessage
	severity?: NoteSeverity
	color?: string
}

type NullableProps<T> = {
	[K in keyof T]: T[K] | null
}

/** A "Line" in NRK Lingo. */
export interface DBPart extends IBlueprintPart {
	_id: PartId
	/** Position inside the segment */
	_rank: number

	/** The rundown this line belongs to */
	rundownId: RundownId
	segmentId: SegmentId

	/** Holds notes (warnings / errors) thrown by the blueprints during creation */
	notes?: Array<PartNote>

	/** Holds the user-facing explanation for why the part is invalid */
	invalidReason?: PartInvalidReason

	/** Human readable unqiue identifier of the part */
	identifier?: string

	/** A modified expectedDuration with the planned preroll and other timings factored in */
	expectedDurationWithPreroll: number | undefined

	/**
	 * Original values of properties overriden by some features.
	 * Currently this only supports the QuickLoop
	 */
	overridenProperties?: Partial<NullableProps<IBlueprintPart>>
}

export function isPartPlayable(part: Pick<ReadonlyDeep<DBPart>, 'invalid' | 'floated'>): boolean {
	return !part.invalid && !part.floated
}

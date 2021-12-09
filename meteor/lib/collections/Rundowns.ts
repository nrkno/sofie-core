import { Time, registerCollection, ProtectedString, ProtectedStringProperties } from '../lib'
import { Segments, Segment } from './Segments'
import { Parts, Part, DBPart } from './Parts'
import { FindOptions, MongoQuery } from '../typings/meteor'
import { StudioId } from './Studios'
import { Meteor } from 'meteor/meteor'
import { IBlueprintRundownDB } from '@sofie-automation/blueprints-integration'
import { ShowStyleVariant, ShowStyleVariants } from './ShowStyleVariants'
import { ShowStyleBase, ShowStyleBases, ShowStyleBaseId } from './ShowStyleBases'
import { RundownNote } from '../api/notes'
import { RundownPlaylists, RundownPlaylist, RundownPlaylistId } from './RundownPlaylists'
import { createMongoCollection } from './lib'
import { PeripheralDeviceId } from './PeripheralDevices'
import { OrganizationId } from './Organization'
import { registerIndex } from '../database'

export enum RundownHoldState {
	NONE = 0,
	PENDING = 1, // During STK
	ACTIVE = 2, // During full, STK is played
	COMPLETE = 3, // During full, full is played
}

export interface RundownImportVersions {
	studio: string
	showStyleBase: string
	showStyleVariant: string
	blueprint: string

	core: string
}
/** A string, identifying a Rundown */
export type RundownId = ProtectedString<'RundownId'>
/** This is a very uncomplete mock-up of the Rundown object */
export interface DBRundown
	extends ProtectedStringProperties<IBlueprintRundownDB, '_id' | 'playlistId' | 'showStyleVariantId'> {
	_id: RundownId
	/** ID of the organization that owns the rundown */
	organizationId: OrganizationId | null
	/** The id of the Studio this rundown is in */
	studioId: StudioId

	/** The ShowStyleBase this Rundown uses (its the parent of the showStyleVariant) */
	showStyleBaseId: ShowStyleBaseId
	/** The peripheral device the rundown originates from */
	peripheralDeviceId?: PeripheralDeviceId
	restoredFromSnapshotId?: RundownId
	created: Time
	modified: Time

	/** Revisions/Versions of various docs that when changed require the user to reimport the rundown */
	importVersions: RundownImportVersions

	status?: string
	// There should be something like a Owner user here somewhere?

	/** Is the rundown in an unsynced (has been unpublished from ENPS) state? */
	orphaned?: 'deleted' | 'from-snapshot' | 'manual'

	/** Last sent storyStatus to ingestDevice (MOS) */
	notifiedCurrentPlayingPartExternalId?: string

	/** Holds notes (warnings / errors) thrown by the blueprints during creation, or appended after */
	notes?: Array<RundownNote>

	/** External id of the Rundown Playlist to put this rundown in */
	playlistExternalId?: string
	/** Whether the end of the rundown marks a commercial break */
	endOfRundownIsShowBreak?: boolean
	/** Name (user-facing) of the external NCS this rundown came from */
	externalNRCSName: string
	/** The id of the Rundown Playlist this rundown is in */
	playlistId: RundownPlaylistId
	/** If the playlistId has ben set manually by a user in Sofie */
	playlistIdIsSetInSofie?: boolean
	/** Rank of the Rundown inside of its Rundown Playlist */
	_rank: number
	/** Whenever the baseline (RundownBaselineObjs, RundownBaselineAdLibItems, RundownBaselineAdLibActions) changes, this is changed too */
	baselineModifyHash?: string
}
export type Rundown = DBRundown

/**
 * Direct database accessors for the Rundown
 * These used to reside on the Rundown class
 */
export class RundownCollectionUtil {
	static getRundownPlaylist(rundown: Pick<DBRundown, 'playlistId'>): RundownPlaylist {
		if (!rundown.playlistId) throw new Meteor.Error(500, 'Rundown is not a part of a rundown playlist!')
		const pls = RundownPlaylists.findOne(rundown.playlistId)
		if (pls) {
			return pls
		} else throw new Meteor.Error(404, `Rundown Playlist "${rundown.playlistId}" not found!`)
	}
	static getShowStyleVariant(rundown: Pick<DBRundown, 'showStyleVariantId'>): ShowStyleVariant {
		const showStyleVariant = ShowStyleVariants.findOne(rundown.showStyleVariantId)
		if (!showStyleVariant)
			throw new Meteor.Error(404, `ShowStyleVariant "${rundown.showStyleVariantId}" not found!`)
		return showStyleVariant
	}
	static getShowStyleBase(rundown: Pick<DBRundown, 'showStyleBaseId'>): ShowStyleBase {
		const showStyleBase = ShowStyleBases.findOne(rundown.showStyleBaseId)
		if (!showStyleBase) throw new Meteor.Error(404, `ShowStyleBase "${rundown.showStyleBaseId}" not found!`)
		return showStyleBase
	}
	static getSegments(
		rundown: Pick<DBRundown, '_id'>,
		selector?: MongoQuery<Segment>,
		options?: FindOptions<Segment>
	): Segment[] {
		return Segments.find(
			{
				rundownId: rundown._id,
				...selector,
			},
			{
				sort: { _rank: 1 },
				...options,
			}
		).fetch()
	}
	static getParts(
		rundown: Pick<DBRundown, '_id'>,
		selector?: MongoQuery<Part>,
		options?: FindOptions<DBPart>,
		segmentsInOrder?: Array<Pick<Segment, '_id'>>
	): Part[] {
		const parts = Parts.find(
			{
				rundownId: rundown._id,
				...selector,
			},
			{
				sort: { _rank: 1 },
				...options,
			}
		).fetch()

		if (options?.sort) {
			// User explicitly sorted the parts
			return parts
		} else {
			// Default to sorting within the rundown
			return RundownPlaylist._sortPartsInner(
				parts,
				segmentsInOrder || RundownCollectionUtil.getSegments(rundown, undefined, { fields: { _id: 1 } })
			)
		}
	}
	/** Synchronous version of getSegmentsAndParts, to be used client-side */
	static getSegmentsAndPartsSync(rundown: Pick<DBRundown, '_id'>): { segments: Segment[]; parts: Part[] } {
		const segments = Segments.find(
			{
				rundownId: rundown._id,
			},
			{ sort: { _rank: 1 } }
		).fetch()

		const parts = Parts.find(
			{
				rundownId: rundown._id,
			},
			{ sort: { _rank: 1 } }
		).fetch()

		return {
			segments: segments,
			parts: RundownPlaylist._sortPartsInner(parts, segments),
		}
	}
}

export const Rundowns = createMongoCollection<Rundown>('rundowns')
registerCollection('Rundowns', Rundowns)

registerIndex(Rundowns, {
	playlistId: 1,
})
registerIndex(Rundowns, {
	playlistExternalId: 1,
})

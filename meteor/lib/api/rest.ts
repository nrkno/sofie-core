import { ClientAPI } from '../api/client'
import {
	AdLibActionId,
	BlueprintId,
	BucketAdLibId,
	PartId,
	PartInstanceId,
	PeripheralDeviceId,
	PieceId,
	RundownBaselineAdLibActionId,
	RundownPlaylistId,
	SegmentId,
	ShowStyleBaseId,
	ShowStyleVariantId,
	StudioId,
} from '@sofie-automation/corelib/dist/dataModel/Ids'
import { Meteor } from 'meteor/meteor'

/* *************************************************************************
This file contains types and interfaces that are used by the REST API.
When making changes to these types, you should be aware of any breaking changes
and update packages/openapi accordingly if needed.
************************************************************************* */

export interface RestAPI {
	/**
	 * Returns the current version of Sofie
	 */
	index(): Promise<ClientAPI.ClientResponse<{ version: string }>>
	/**
	 * Gets all available RundownPlaylists.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 */
	getAllRundownPlaylists(
		connection: Meteor.Connection,
		event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>>
	/**
	 * Activates a Playlist.
	 *
	 * Throws if there is already an active Playlist for the studio that the Playlist belongs to.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to activate.
	 * @param rehearsal Whether to activate into rehearsal mode.
	 */
	activate(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		rehearsal: boolean
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Deactivates a Playlist.
	 *
	 * Throws if the Playlist is not currently active.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to deactivate.
	 */
	deactivate(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Executes the requested AdLib/AdLib Action. This is a "planned" AdLib (Action) that has been produced by the blueprints during the ingest process.
	 *
	 * Throws if the target Playlist is not active.
	 * Throws if there is not an on-at part instance.
	 * @returns a `ClientResponseError` if an adLib for the provided `adLibId` cannot be found.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to execute adLib in.
	 * @param adLibId AdLib to execute.
	 * @param triggerMode A string to specify a particular variation for the AdLibAction, valid actionType strings are to be read from the status API.
	 */
	executeAdLib(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		adLibId: AdLibActionId | RundownBaselineAdLibActionId | PieceId | BucketAdLibId,
		triggerMode?: string
	): Promise<ClientAPI.ClientResponse<object>>
	/**
	 * Moves the next point by `delta` places. Negative values are allowed to move "backwards" in the script.
	 *
	 * Throws if the target Playlist is not active.
	 * Throws if there is both no current or next Part.
	 * If delta results in an index that is greater than the number of Parts available, no action will be taken.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to target.
	 * @param delta Amount to move next point by (+/-)
	 */
	moveNextPart(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		delta: number
	): Promise<ClientAPI.ClientResponse<PartId | null>>
	/**
	 * Moves the next Segment point by `delta` places. Negative values are allowed to move "backwards" in the script.
	 *
	 * Throws if the target Playlist is not active.
	 * Throws if there is both no current or next Part.
	 * If delta results in an index that is greater than the number of Segments available, no action will be taken.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to target.
	 * @param delta Amount to move next Segment point by (+/-)
	 */
	moveNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		delta: number
	): Promise<ClientAPI.ClientResponse<PartId | null>>
	/**
	 * Reloads a Playlist from its ingest source (e.g. MOS/Spreadsheet etc.)
	 *
	 * Throws if the target Playlist is currently active.
	 * @returns a `ClientResponseError` if the playlist fails to reload
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to reload.
	 */
	reloadPlaylist(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<object>>
	/**
	 * Resets a Playlist back to its pre-played state.
	 *
	 * Throws if the target Playlist is currently active unless reset while on-air is enabled in settings.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Playlist to reset.
	 */
	resetPlaylist(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Sets the next Part to a given PartId.
	 *
	 * Throws if the target playlist is not currently active.
	 * Throws if the specified Part does not exist.
	 * Throws if the specified Part is not playable.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Target rundown playlist.
	 * @param partId Part to set as next.
	 */
	setNextPart(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		partId: PartId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Sets the next Segment to a given SegmentId.
	 *
	 * Throws if the target Playlist is not currently active.
	 * Throws if the specified Segment does not exist.
	 * Throws if the specified Segment does not contain any playable parts.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Target Playlist.
	 * @param segmentId Segment to set as next.
	 */
	setNextSegment(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		segmentId: SegmentId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Performs a take in the given Playlist.
	 *
	 * Throws if spcified Playlist is not active.
	 * Throws if specified Playlist does not have a next Part.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Target Playlist.
	 * @param fromPartInstanceId Part instance this take is for, used as a safety guard against performing multiple takes when only one was intended.
	 */
	take(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		fromPartInstanceId: PartInstanceId | undefined
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Sets a route set to the described state
	 *
	 * Throws if specified studioId does not exist
	 * Throws if specified route set does not exist
	 * Throws if `state` is `false` and the specified route set cannot be deactivated.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Studio to target
	 * @param routeSetId Route set within studio
	 * @param state Whether state should be set to active (true) or inactive (false)
	 */
	switchRouteSet(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId,
		routeSetId: string,
		state: boolean
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Clears the specified SourceLayer.
	 *
	 * Throws if specified playlist is not active.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Target Playlist.
	 * @param sourceLayerId Target SourceLayer.
	 */
	clearSourceLayer(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerId: string
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Recalls the last sticky Piece on the specified SourceLayer, if there is any.
	 *
	 * Throws if specified playlist is not active.
	 * Throws if specified SourceLayer is not sticky.
	 * Throws if there is no sticky piece for this SourceLayer.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param rundownPlaylistId Target Playlist.
	 * @param sourceLayerId Target SourceLayer.
	 */
	recallStickyPiece(
		connection: Meteor.Connection,
		event: string,
		rundownPlaylistId: RundownPlaylistId,
		sourceLayerId: string
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Gets all devices attached to Sofie.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 */
	getPeripheralDevices(
		connection: Meteor.Connection,
		event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>>
	/**
	 * Get a specific device.
	 *
	 * Throws if the requested device does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param deviceId Device to get
	 */
	getPeripheralDevice(
		connection: Meteor.Connection,
		event: string,
		deviceId: PeripheralDeviceId
	): Promise<ClientAPI.ClientResponse<APIPeripheralDevice>>
	/**
	 * Send an action to a device.
	 *
	 * Throws if the requested device does not exits.
	 * Throws if the action is not valid for the requested device.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param deviceId Device to target
	 * @param action Action to perform
	 */
	peripheralDeviceAction(
		connection: Meteor.Connection,
		event: string,
		deviceId: PeripheralDeviceId,
		action: PeripheralDeviceAction
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Fetches all of the peripheral devices attached to a studio.
	 *
	 * Throws if the requested Studio does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Studio to fetch devices for
	 */
	getPeripheralDevicesForStudio(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>>
	/*
	 * Gets all available Blueprints.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 */
	getAllBlueprints(
		connection: Meteor.Connection,
		event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>>
	/**
	 * Gets a specific Blueprint.
	 *
	 * Throws if the specified Blueprint does not exist.
	 * Throws if the specified Blueprint is of unknown type.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param blueprintId Blueprint to fetch
	 */
	getBlueprint(
		connection: Meteor.Connection,
		event: string,
		blueprintId: BlueprintId
	): Promise<ClientAPI.ClientResponse<APIBlueprint>>
	/*
	 * Assigns a specified Blueprint to the system.
	 *
	 * Throws if the specified Blueprint does not exist.
	 * Throws if the specified Blueprint is not a 'system' Blueprint.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param blueprintId Blueprint to assign
	 */
	assignSystemBlueprint(
		connection: Meteor.Connection,
		event: string,
		blueprintId: BlueprintId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Unassigns the assigned system Blueprint, if any Blueprint is currently assigned.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 */
	unassignSystemBlueprint(connection: Meteor.Connection, event: string): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Assigns a device to a studio.
	 *
	 * Throws if the device is already attached to a studio.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Studio to attach to
	 * @param deviceId Device to attach
	 */
	attachDeviceToStudio(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId,
		deviceId: PeripheralDeviceId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Detaches a device from a studio.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Studio to detach from
	 * @param deviceId Device to detach
	 */
	detachDeviceFromStudio(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId,
		deviceId: PeripheralDeviceId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Returns the Ids of all ShowStyleBases available in Sofie.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 */
	getShowStyleBases(
		connection: Meteor.Connection,
		event: string
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>>
	/**
	 * Adds a ShowStyleBase, returning the newly created Id.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBase ShowStyleBase to insert
	 */
	addShowStyleBase(
		connection: Meteor.Connection,
		event: string,
		showStyleBase: APIShowStyleBase
	): Promise<ClientAPI.ClientResponse<string>>
	/**
	 * Gets a ShowStyleBase.
	 *
	 * Throws if the ShowStyleBase does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBaseId to fetch
	 */
	getShowStyleBase(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<APIShowStyleBase>>
	/**
	 * Updates an existing ShowStyleBase, or creates it if it does not currently exist.
	 *
	 * Throws if the ShowStyleBase is currently in use in an active Rundown.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBase to update or insert
	 * @param showStyleBase ShowStyleBase to insert
	 */
	addOrUpdateShowStyleBase(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleBase: APIShowStyleBase
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Removed a ShowStyleBase.
	 *
	 * Throws if the ShowStyleBase is in use in an active Rundown.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBase to update or insert
	 */
	deleteShowStyleBase(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Gets the Ids of all ShowStyleVariants that belong to a specified ShowStyleBase.
	 *
	 * Throws if the specified ShowStyleBase does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBase to fetch ShowStyleVariants for
	 */
	getShowStyleVariants(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId
	): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>>
	/**
	 * Adds a ShowStyleVariant to a specified ShowStyleBase.
	 *
	 * Throws if the specified ShowStyleBase does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBase to add a ShowStyleVariant to
	 * @param showStyleVariant ShowStyleVariant to add
	 */
	addShowStyleVariant(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariant: APIShowStyleVariant
	): Promise<ClientAPI.ClientResponse<string>>
	/**
	 * Gets a ShowStyleVariant.
	 *
	 * Throws if the specified ShowStyleVariant does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBase the ShowStyleVariant belongs to
	 * @param showStyleVariant ShowStyleVariant to fetch
	 */
	getShowStyleVariant(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariant: ShowStyleVariantId
	): Promise<ClientAPI.ClientResponse<APIShowStyleVariant>>
	/**
	 * Updates an existing ShowStyleVariant, or creates it if it does not exist.
	 *
	 * Throws if the specified ShowStyleBase does not exist.
	 * Throws if the ShowStyleVariant is currently in use in an active Rundown.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBase to add a ShowStyleVariant to
	 * @param showStyleVariantId ShowStyleVariant Id to add/update
	 * @param showStyleVariant ShowStyleVariant to add/update
	 */
	addOrUpdateShowStyleVariant(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariantId: ShowStyleVariantId,
		showStyleVariant: APIShowStyleVariant
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Deletes a specified ShowStyleVariant.
	 *
	 * Throws if the specified ShowStyleBase does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBase the ShowStyleVariant belongs to
	 * @param showStyleVariantId ShowStyleVariant to delete
	 */
	deleteShowStyleVariant(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId,
		showStyleVariantId: ShowStyleVariantId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Gets the Ids of all Studios.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 */
	getStudios(connection: Meteor.Connection, event: string): Promise<ClientAPI.ClientResponse<Array<{ id: string }>>>
	/**
	 * Adds a new Studio, returns the Id of the newly created Studio.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studio Studio to add
	 */
	addStudio(
		connection: Meteor.Connection,
		event: string,
		studio: APIStudio
	): Promise<ClientAPI.ClientResponse<string>>
	/**
	 * Gets a Studio, if it exists.
	 *
	 * Throws if the specified Studio does not exist.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Id of the Studio to fetch
	 */
	getStudio(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<APIStudio>>
	/**
	 * Adds a new Studio or updates an already existing one.
	 *
	 * Throws if the Studio already exists and is in use in an active Rundown.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Id of the Studio to add or update
	 * @param studio Studio to add or update
	 */
	addOrUpdateStudio(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId,
		studio: APIStudio
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Deletes a Studio.
	 *
	 * Throws if the specified Studio is in use in an active Rundown.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Id of the Studio to delete
	 */
	deleteStudio(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Send an action to a studio.
	 *
	 * Throws if the requested studio does not exits.
	 * Throws if the action is not valid for the requested studio.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param studioId Studio to target
	 * @param action Action to perform
	 */
	studioAction(
		connection: Meteor.Connection,
		event: string,
		studioId: StudioId,
		action: StudioAction
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Send an action to a ShowStyleBase.
	 *
	 * Throws if the requested ShowStyleBase does not exits.
	 * Throws if the action is not valid for the requested ShowStyleBase.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param showStyleBaseId ShowStyleBase to target
	 * @param action Action to perform
	 */
	showStyleBaseAction(
		connection: Meteor.Connection,
		event: string,
		showStyleBaseId: ShowStyleBaseId,
		action: ShowStyleBaseAction
	): Promise<ClientAPI.ClientResponse<void>>
	/**
	 * Get the pending migration steps at the system level.
	 *
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 */
	getPendingMigrations(
		connection: Meteor.Connection,
		event: string
	): Promise<ClientAPI.ClientResponse<{ inputs: PendingMigrations }>>
	/**
	 * Apply system-level migrations.
	 *
	 * Throws if any of the specified migrations have already been applied.
	 * @param connection Connection data including client and header details
	 * @param event User event string
	 * @param inputs Migration data to apply
	 */
	applyPendingMigrations(
		connection: Meteor.Connection,
		event: string,
		inputs: MigrationData
	): Promise<ClientAPI.ClientResponse<void>>
}

// This interface should be auto-generated in future
export interface APIPeripheralDevice {
	id: string
	name: string
	status: 'unknown' | 'good' | 'warning_major' | 'marning_minor' | 'bad' | 'fatal'
	messages: string[]
	deviceType:
		| 'unknown'
		| 'mos'
		| 'spreadsheet'
		| 'inews'
		| 'playout'
		| 'media_manager'
		| 'package_manager'
		| 'live_status'
		| 'input'
	connected: boolean
}

export enum PeripheralDeviceActionType {
	RESTART = 'restart',
}

export interface PeripheralDeviceActionBase {
	type: PeripheralDeviceActionType
}

export interface PeripheralDeviceActionRestart extends PeripheralDeviceActionBase {
	type: PeripheralDeviceActionType.RESTART
}

export type PeripheralDeviceAction = PeripheralDeviceActionRestart

export enum StudioActionType {
	BLUEPRINT_UPGRADE = 'blueprint_upgrade',
}

export interface StudioActionBase {
	type: StudioActionType
}

export interface StudioActionBlueprintUpgrade extends StudioActionBase {
	type: StudioActionType.BLUEPRINT_UPGRADE
}

export type StudioAction = StudioActionBlueprintUpgrade

export enum ShowStyleBaseActionType {
	BLUEPRINT_UPGRADE = 'blueprint_upgrade',
}

export interface ShowStyleBaseActionBase {
	type: ShowStyleBaseActionType
}

export interface ShowStyleBaseActionBlueprintUpgrade extends ShowStyleBaseActionBase {
	type: ShowStyleBaseActionType.BLUEPRINT_UPGRADE
}

export type ShowStyleBaseAction = ShowStyleBaseActionBlueprintUpgrade

export interface APIBlueprint {
	id: string
	name: string
	blueprintType: 'system' | 'studio' | 'showstyle'
	blueprintVersion: string
}

export interface APIShowStyleBase {
	name: string
	blueprintId: string
	blueprintConfigPresetId?: string
	outputLayers: APIOutputLayer[]
	sourceLayers: APISourceLayer[]
	config: object
}

export interface APIShowStyleVariant {
	name: string
	showStyleBaseId: string
	config: object
	rank: number
}

export interface APIOutputLayer {
	id: string
	name: string
	rank: number
	isPgm: boolean
}

export interface APISourceLayer {
	id: string
	name: string
	abbreviation?: string
	rank: number
	layerType:
		| 'unknown'
		| 'camera'
		| 'vt'
		| 'remote'
		| 'script'
		| 'graphics'
		| 'splits'
		| 'audio'
		| 'lower-third'
		| 'live-speak'
		| 'transition'
		| 'local'
	exclusiveGroup?: string
}

export interface APIStudio {
	name: string
	blueprintId?: string
	blueprintConfigPresetId?: string
	supportedShowStyleBase?: string[]
	config: object
	settings: APIStudioSettings
}

export interface APIStudioSettings {
	frameRate: number
	mediaPreviewsUrl: string
	slackEvaluationUrls?: string[]
	supportedMediaFormats?: string[]
	supportedAudioStreams?: string[]
	enablePlayFromAnywhere?: boolean
	forceMultiGatewayMode?: boolean
	multiGatewayNowSafeLatency?: number
	preserveUnsyncedPlayingSegmentContents?: boolean
	allowRundownResetOnAir?: boolean
	preserveOrphanedSegmentPositionInRundown?: boolean
}

export interface PendingMigrationStep {
	stepId: string
	attributeId: string
}

export type PendingMigrations = Array<PendingMigrationStep>

export interface MigrationStepData {
	stepId: string
	attributeId: string
	migrationValue: string | number | boolean
}

export type MigrationData = Array<MigrationStepData>

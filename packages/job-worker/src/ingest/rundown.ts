import { ExtendedIngestRundown } from '@sofie-automation/blueprints-integration'
import { ShowStyleBaseId, ShowStyleVariantId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { DBShowStyleBase, ShowStyleCompound } from '@sofie-automation/corelib/dist/dataModel/ShowStyleBase'
import { DBShowStyleVariant } from '@sofie-automation/corelib/dist/dataModel/ShowStyleVariant'
import { protectString, unprotectObjectArray } from '@sofie-automation/corelib/dist/protectedString'
import { loadShowStyleBlueprint } from '../blueprints/cache'
import { logger } from '../logging'
import { createShowStyleCompound } from '../showStyles'
import _ = require('underscore')
import { StudioUserContext } from '../blueprints/context'
import { JobContext } from '../jobs'
import { clone } from '@sofie-automation/corelib/dist/lib'

export async function selectShowStyleVariant(
	context: JobContext,
	blueprintContext: StudioUserContext,
	ingestRundown: ExtendedIngestRundown
): Promise<{ variant: DBShowStyleVariant; base: DBShowStyleBase; compound: ShowStyleCompound } | null> {
	const studio = blueprintContext.studio
	if (!studio.supportedShowStyleBase.length) {
		logger.debug(`Studio "${studio._id}" does not have any supportedShowStyleBase`)
		return null
	}
	const showStyleBases = await context.directCollections.ShowStyleBases.findFetch({
		_id: { $in: clone<Array<ShowStyleBaseId>>(studio.supportedShowStyleBase) },
	})
	let showStyleBase = _.first(showStyleBases)
	if (!showStyleBase) {
		logger.debug(
			`No showStyleBases matching with supportedShowStyleBase [${studio.supportedShowStyleBase}] from studio "${studio._id}"`
		)
		return null
	}

	const studioBlueprint = context.studioBlueprint
	if (!studioBlueprint) throw new Error(`Studio "${studio._id}" does not have a blueprint`)

	if (!studioBlueprint.blueprint.getShowStyleId)
		throw new Error(`Studio "${studio._id}" blueprint missing property getShowStyleId`)

	const showStyleId: ShowStyleBaseId | null = protectString(
		studioBlueprint.blueprint.getShowStyleId(
			blueprintContext,
			unprotectObjectArray(showStyleBases) as any,
			ingestRundown
		)
	)
	if (showStyleId === null) {
		logger.debug(`StudioBlueprint for studio "${studio._id}" returned showStyleId = null`)
		return null
	}
	showStyleBase = _.find(showStyleBases, (s) => s._id === showStyleId)
	if (!showStyleBase) {
		logger.debug(
			`No ShowStyleBase found matching showStyleId "${showStyleId}", from studio "${studio._id}" blueprint`
		)
		return null
	}
	const showStyleVariants = await context.directCollections.ShowStyleVariants.findFetch({
		showStyleBaseId: showStyleBase._id,
	})
	if (!showStyleVariants.length) throw new Error(`ShowStyleBase "${showStyleBase._id}" has no variants`)

	const showStyleBlueprint = await loadShowStyleBlueprint(context.directCollections, showStyleBase)
	if (!showStyleBlueprint) throw new Error(`ShowStyleBase "${showStyleBase._id}" does not have a valid blueprint`)

	const variantId: ShowStyleVariantId | null = protectString(
		showStyleBlueprint.blueprint.getShowStyleVariantId(
			blueprintContext,
			unprotectObjectArray(showStyleVariants),
			ingestRundown
		)
	)
	if (variantId === null) {
		logger.debug(`StudioBlueprint for studio "${studio._id}" returned variantId = null in .getShowStyleVariantId`)
		return null
	} else {
		const showStyleVariant = _.find(showStyleVariants, (s) => s._id === variantId)
		if (!showStyleVariant) throw new Error(`Blueprint returned variantId "${variantId}", which was not found!`)

		const compound = createShowStyleCompound(showStyleBase, showStyleVariant)
		if (!compound) throw new Error(`no showStyleCompound for "${showStyleVariant._id}"`)

		return {
			variant: showStyleVariant,
			base: showStyleBase,
			compound,
		}
	}
}

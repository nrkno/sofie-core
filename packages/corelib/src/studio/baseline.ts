import { DBStudio } from '../dataModel/Studio'
import { StatObjectMetadata, TimelineComplete } from '../dataModel/Timeline'
import { ReadonlyDeep } from 'type-fest'
import { unprotectString } from '../protectedString'
import { Blueprint } from '../dataModel/Blueprint'

export function shouldUpdateStudioBaselineInner(
	coreVersion: string, // TODO - is this ok?
	studio: ReadonlyDeep<DBStudio>,
	studioTimeline: ReadonlyDeep<TimelineComplete> | undefined,
	studioBlueprint: Pick<Blueprint, 'blueprintVersion'> | null
): string | false {
	if (!studioTimeline) return 'noBaseline'
	const markerObject = studioTimeline.timeline.find((x) => x.id === `baseline_version`)
	if (!markerObject) return 'noBaseline'

	const versionsContent = (markerObject.metaData as Partial<StatObjectMetadata> | undefined)?.versions

	if (versionsContent?.core !== coreVersion) return 'coreVersion'

	if (versionsContent?.studio !== (studio._rundownVersionHash || 0)) return 'studio'

	if (versionsContent?.blueprintId !== unprotectString(studio.blueprintId)) return 'blueprintId'
	if (studio.blueprintId) {
		if (!studioBlueprint) return 'blueprintUnknown'
		if (versionsContent.blueprintVersion !== (studioBlueprint.blueprintVersion || 0)) return 'blueprintVersion'
	}

	return false
}

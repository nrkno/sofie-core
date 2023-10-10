import { PieceInstanceInfiniteId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { Time } from '@sofie-automation/blueprints-integration'

export interface PlayoutPieceInstanceModel {
	readonly PieceInstance: ReadonlyDeep<PieceInstance>

	updatePieceProps(props: Partial<PieceInstancePiece>): void

	setPlannedStartedPlayback(time: Time): boolean
	setPlannedStoppedPlayback(time: Time | undefined): boolean
	setReportedStartedPlayback(time: Time): boolean
	setReportedStoppedPlayback(time: Time): boolean

	prepareForHold(): PieceInstanceInfiniteId

	setDuration(duration: Required<PieceInstance>['userDuration']): void

	setDisabled(disabled: boolean): void
}

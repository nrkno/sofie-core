import { PieceInstanceInfiniteId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ReadonlyDeep } from 'type-fest'
import { PieceInstance, PieceInstancePiece } from '@sofie-automation/corelib/dist/dataModel/PieceInstance'
import { Time } from '@sofie-automation/blueprints-integration'

export interface PlayoutPieceInstanceModel {
	readonly PieceInstance: ReadonlyDeep<PieceInstance>

	prepareForHold(): PieceInstanceInfiniteId

	setDisabled(disabled: boolean): void

	setDuration(duration: Required<PieceInstance>['userDuration']): void

	setPlannedStartedPlayback(time: Time): boolean
	setPlannedStoppedPlayback(time: Time | undefined): boolean
	setReportedStartedPlayback(time: Time): boolean
	setReportedStoppedPlayback(time: Time): boolean

	updatePieceProps(props: Partial<PieceInstancePiece>): void
}

import * as _ from 'underscore'
import { MeteorPromiseApply } from '../lib'
import { NewBlueprintAPI, BlueprintAPIMethods } from '@sofie-automation/meteor-lib/dist/api/blueprint'
import { NewClientAPI, ClientAPIMethods } from '@sofie-automation/meteor-lib/dist/api/client'
import {
	NewExternalMessageQueueAPI,
	ExternalMessageQueueAPIMethods,
} from '@sofie-automation/meteor-lib/dist/api/ExternalMessageQueue'
import { NewMigrationAPI, MigrationAPIMethods } from '@sofie-automation/meteor-lib/dist/api/migration'
import { NewPlayoutAPI, PlayoutAPIMethods } from '@sofie-automation/meteor-lib/dist/api/playout'
import { NewRundownAPI, RundownAPIMethods } from '@sofie-automation/meteor-lib/dist/api/rundown'
import { NewRundownLayoutsAPI, RundownLayoutsAPIMethods } from './rundownLayouts'
import { NewShowStylesAPI, ShowStylesAPIMethods } from '@sofie-automation/meteor-lib/dist/api/showStyles'
import { NewSnapshotAPI, SnapshotAPIMethods } from '@sofie-automation/meteor-lib/dist/api/shapshot'
import { NewSystemStatusAPI, SystemStatusAPIMethods } from '@sofie-automation/meteor-lib/dist/api/systemStatus'
import { NewUserActionAPI, UserActionAPIMethods } from '@sofie-automation/meteor-lib/dist/api/userActions'
import { StudiosAPIMethods, NewStudiosAPI } from '@sofie-automation/meteor-lib/dist/api/studios'
import { NewOrganizationAPI, OrganizationAPIMethods } from '@sofie-automation/meteor-lib/dist/api/organization'
import { NewUserAPI, UserAPIMethods } from '@sofie-automation/meteor-lib/dist/api/user'
import { SystemAPIMethods, SystemAPI } from '@sofie-automation/meteor-lib/dist/api/system'
import { Meteor } from 'meteor/meteor'
import {
	NewTriggeredActionsAPI,
	TriggeredActionsAPIMethods,
} from '@sofie-automation/meteor-lib/dist/api/triggeredActions'
import { UserId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import {
	NewPeripheralDeviceAPI,
	PeripheralDeviceAPIMethods,
} from '@sofie-automation/shared-lib/dist/peripheralDevice/methodsAPI'
import { MeteorMethodsAPIBase } from '@sofie-automation/meteor-lib/dist/api/apiBase'

/** All methods typings are defined here, the actual implementation is defined in other places */
export type MethodsBase = {
	[key: string]: (...args: any[]) => Promise<any>
}
interface IMeteorCall {
	blueprint: NewBlueprintAPI
	client: NewClientAPI
	externalMessages: NewExternalMessageQueueAPI
	migration: NewMigrationAPI
	peripheralDevice: NewPeripheralDeviceAPI
	playout: NewPlayoutAPI
	rundown: NewRundownAPI
	rundownLayout: NewRundownLayoutsAPI
	snapshot: NewSnapshotAPI
	showstyles: NewShowStylesAPI
	triggeredActions: NewTriggeredActionsAPI
	studio: NewStudiosAPI
	systemStatus: NewSystemStatusAPI
	user: NewUserAPI
	userAction: NewUserActionAPI
	organization: NewOrganizationAPI
	system: SystemAPI
}
export const MeteorCall: IMeteorCall = {
	blueprint: makeMethods(BlueprintAPIMethods),
	client: makeMethods(ClientAPIMethods),
	externalMessages: makeMethods(ExternalMessageQueueAPIMethods),
	migration: makeMethods(MigrationAPIMethods),
	peripheralDevice: makeMethods(PeripheralDeviceAPIMethods),
	playout: makeMethods(PlayoutAPIMethods),
	rundown: makeMethods(RundownAPIMethods),
	rundownLayout: makeMethods(RundownLayoutsAPIMethods),
	snapshot: makeMethods(SnapshotAPIMethods),
	showstyles: makeMethods(ShowStylesAPIMethods),
	triggeredActions: makeMethods(TriggeredActionsAPIMethods),
	studio: makeMethods(StudiosAPIMethods),
	systemStatus: makeMethods(SystemStatusAPIMethods),
	user: makeMethods(UserAPIMethods),
	userAction: makeMethods(UserActionAPIMethods, ['storeRundownSnapshot']),
	organization: makeMethods(OrganizationAPIMethods),
	system: makeMethods(SystemAPIMethods),
}
function makeMethods<Enum extends { [key: string]: string }>(
	methods: Enum,
	/** (Optional) An array of methodnames. Calls to these methods won't be retried in the case of a loss-of-connection for the client. */
	listOfMethodsThatShouldNotRetry?: (keyof Enum)[]
): any {
	const resultingMethods: Record<string, (...args: any[]) => any> = {}
	_.each(methods, (serverMethodName: any, methodName: string) => {
		if (listOfMethodsThatShouldNotRetry?.includes(methodName)) {
			resultingMethods[methodName] = async (...args: any[]) =>
				MeteorPromiseApply(serverMethodName, args, {
					noRetry: true,
				})
		} else {
			resultingMethods[methodName] = async (...args: any[]) => MeteorPromiseApply(serverMethodName, args)
		}
	})
	return resultingMethods
}
export interface MethodContext extends Omit<Meteor.MethodThisType, 'userId'> {
	userId: UserId | null
}

/** Abstarct class to be used when defining Mehod-classes */
export abstract class MethodContextAPI implements MethodContext, MeteorMethodsAPIBase {
	// These properties are added by Meteor to the `this` context when calling methods
	public userId!: UserId | null
	public isSimulation!: boolean
	public setUserId(_userId: string | null): void {
		throw new Meteor.Error(
			500,
			`This shoulc never be called, there's something wrong in with 'this' in the calling method`
		)
	}
	public unblock(): void {
		throw new Meteor.Error(
			500,
			`This shoulc never be called, there's something wrong in with 'this' in the calling method`
		)
	}
	public connection!: Meteor.Connection | null
}

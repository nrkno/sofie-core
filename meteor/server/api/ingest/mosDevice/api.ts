import * as MOS from 'mos-connection';
import { setMeteorMethods, Methods } from '../../../methods';
import { PeripheralDeviceAPI } from '../../../../lib/api/peripheralDevice';
import { MosIntegration } from './mosIntegration';

let methods: Methods = {};
methods[PeripheralDeviceAPI.methods.mosRoCreate] = (
	deviceId: string,
	deviceToken: string,
	mosRunningOrder: MOS.IMOSRunningOrder
) => {
	return MosIntegration.mosRoCreate(deviceId, deviceToken, mosRunningOrder);
};
methods[PeripheralDeviceAPI.methods.mosRoReplace] = (
	deviceId: string,
	deviceToken: string,
	mosRunningOrder: MOS.IMOSRunningOrder
) => {
	return MosIntegration.mosRoReplace(deviceId, deviceToken, mosRunningOrder);
};
methods[PeripheralDeviceAPI.methods.mosRoDelete] = (
	deviceId: string,
	deviceToken: string,
	mosRunningOrderId: MOS.MosString128,
	force?: boolean
) => {
	return MosIntegration.mosRoDelete(
		deviceId,
		deviceToken,
		mosRunningOrderId,
		force
	);
};
methods[PeripheralDeviceAPI.methods.mosRoMetadata] = (
	deviceId: string,
	deviceToken: string,
	metadata: MOS.IMOSRunningOrderBase
) => {
	return MosIntegration.mosRoMetadata(deviceId, deviceToken, metadata);
};
methods[PeripheralDeviceAPI.methods.mosRoStatus] = (
	deviceId: string,
	deviceToken: string,
	status: MOS.IMOSRunningOrderStatus
) => {
	return MosIntegration.mosRoStatus(deviceId, deviceToken, status);
};
methods[PeripheralDeviceAPI.methods.mosRoStoryStatus] = (
	deviceId: string,
	deviceToken: string,
	status: MOS.IMOSStoryStatus
) => {
	return MosIntegration.mosRoStoryStatus(deviceId, deviceToken, status);
};
methods[PeripheralDeviceAPI.methods.mosRoItemStatus] = (
	deviceId: string,
	deviceToken: string,
	status: MOS.IMOSItemStatus
) => {
	return MosIntegration.mosRoItemStatus(deviceId, deviceToken, status);
};
methods[PeripheralDeviceAPI.methods.mosRoStoryInsert] = (
	deviceId: string,
	deviceToken: string,
	Action: MOS.IMOSStoryAction,
	Stories: Array<MOS.IMOSROStory>
) => {
	return MosIntegration.mosRoStoryInsert(
		deviceId,
		deviceToken,
		Action,
		Stories
	);
};
methods[PeripheralDeviceAPI.methods.mosRoItemInsert] = (
	deviceId: string,
	deviceToken: string,
	Action: MOS.IMOSItemAction,
	Items: Array<MOS.IMOSItem>
) => {
	return MosIntegration.mosRoItemInsert(deviceId, deviceToken, Action, Items);
};
methods[PeripheralDeviceAPI.methods.mosRoStoryReplace] = (
	deviceId: string,
	deviceToken: string,
	Action: MOS.IMOSStoryAction,
	Stories: Array<MOS.IMOSROStory>
) => {
	return MosIntegration.mosRoStoryReplace(
		deviceId,
		deviceToken,
		Action,
		Stories
	);
};
methods[PeripheralDeviceAPI.methods.mosRoItemReplace] = (
	deviceId: string,
	deviceToken: string,
	Action: MOS.IMOSItemAction,
	Items: Array<MOS.IMOSItem>
) => {
	return MosIntegration.mosRoItemReplace(
		deviceId,
		deviceToken,
		Action,
		Items
	);
};
methods[PeripheralDeviceAPI.methods.mosRoStoryMove] = (
	deviceId: string,
	deviceToken: string,
	Action: MOS.IMOSStoryAction,
	Stories: Array<MOS.MosString128>
) => {
	return MosIntegration.mosRoStoryMove(
		deviceId,
		deviceToken,
		Action,
		Stories
	);
};
methods[PeripheralDeviceAPI.methods.mosRoItemMove] = (
	deviceId: string,
	deviceToken: string,
	Action: MOS.IMOSItemAction,
	Items: Array<MOS.MosString128>
) => {
	return MosIntegration.mosRoItemMove(deviceId, deviceToken, Action, Items);
};
methods[PeripheralDeviceAPI.methods.mosRoStoryDelete] = (
	deviceId: string,
	deviceToken: string,
	Action: MOS.IMOSROAction,
	Stories: Array<MOS.MosString128>
) => {
	return MosIntegration.mosRoStoryDelete(
		deviceId,
		deviceToken,
		Action,
		Stories
	);
};
methods[PeripheralDeviceAPI.methods.mosRoItemDelete] = (
	deviceId: string,
	deviceToken: string,
	Action: MOS.IMOSStoryAction,
	Items: Array<MOS.MosString128>
) => {
	return MosIntegration.mosRoItemDelete(deviceId, deviceToken, Action, Items);
};
methods[PeripheralDeviceAPI.methods.mosRoStorySwap] = (
	deviceId: string,
	deviceToken: string,
	Action: MOS.IMOSROAction,
	StoryID0: MOS.MosString128,
	StoryID1: MOS.MosString128
) => {
	return MosIntegration.mosRoStorySwap(
		deviceId,
		deviceToken,
		Action,
		StoryID0,
		StoryID1
	);
};
methods[PeripheralDeviceAPI.methods.mosRoItemSwap] = (
	deviceId: string,
	deviceToken: string,
	Action: MOS.IMOSStoryAction,
	ItemID0: MOS.MosString128,
	ItemID1: MOS.MosString128
) => {
	return MosIntegration.mosRoItemSwap(
		deviceId,
		deviceToken,
		Action,
		ItemID0,
		ItemID1
	);
};
methods[PeripheralDeviceAPI.methods.mosRoReadyToAir] = (
	deviceId: string,
	deviceToken: string,
	Action: MOS.IMOSROReadyToAir
) => {
	return MosIntegration.mosRoReadyToAir(deviceId, deviceToken, Action);
};
methods[PeripheralDeviceAPI.methods.mosRoFullStory] = (
	deviceId: string,
	deviceToken: string,
	story: MOS.IMOSROFullStory
) => {
	return MosIntegration.mosRoFullStory(deviceId, deviceToken, story);
};

// Apply methods:
setMeteorMethods(methods);

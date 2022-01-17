import { ITranslatableMessage } from '../../blueprints-integration/dist'

// Mock 't' function for i18next to find the keys
function t(key: string): string {
	return key
}

export enum ServerTranslatedMesssages {
	PLAYLIST_ON_AIR_CANT_MOVE_RUNDOWN,
}

const ServerTranslatedMesssagesTranslations: { [key in ServerTranslatedMesssages]: string } = {
	[ServerTranslatedMesssages.PLAYLIST_ON_AIR_CANT_MOVE_RUNDOWN]: t(
		'The Rundown was attempted to be moved out of the Playlist when it was on Air. Move it back and try again later.'
	),
}

export function getTranslatedMessage(
	key: ServerTranslatedMesssages,
	args?: { [key: string]: any }
): ITranslatableMessage {
	return {
		key: ServerTranslatedMesssagesTranslations[key],
		args: args,
	}
}

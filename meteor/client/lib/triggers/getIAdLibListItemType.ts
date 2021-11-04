import { IAdLibListItem } from '../../ui/Shelf/AdLibListItem'

type IAdLibListItemType =
	| 'rundownBaselineAdLibAction'
	| 'adLibAction'
	| 'clearSourceLayer'
	| 'sticky'
	| 'rundownBaselineAdLibItem'
	| 'adLibPiece'

export function getIAdLibListItemType(item: IAdLibListItem): IAdLibListItemType {
	return item.isAction
		? item.isGlobal
			? 'rundownBaselineAdLibAction'
			: 'adLibAction'
		: item.isClearSourceLayer
		? 'clearSourceLayer'
		: item.isSticky
		? 'sticky'
		: item.isGlobal
		? 'rundownBaselineAdLibItem'
		: 'adLibPiece'
}

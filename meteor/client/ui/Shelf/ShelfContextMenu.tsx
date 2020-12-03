import React from 'react'
import { useTranslation } from 'react-i18next'
import { useTracker } from '../../lib/ReactMeteorData/ReactMeteorData'
import Escape from 'react-escape'
import { ContextMenu, MenuItem } from '@jstarpl/react-contextmenu'
import { ReactiveVar } from 'meteor/reactive-var'
import { Bucket } from '../../../lib/collections/Buckets'
import { BucketAdLibItem } from './RundownViewBuckets'
import { AdLibPieceUi } from './AdLibPanel'

export enum ContextType {
	BUCKET = 'bucket',
	BUCKET_ADLIB = 'bucket_adlib',
	ADLIB = 'adlib',
}

interface ShelfContextMenuContextBase {
	type: ContextType
	details?: object
}

export interface ShelfContextMenuContextBucket extends ShelfContextMenuContextBase {
	type: ContextType.BUCKET
	details: {
		bucket: Bucket
	}
}

export interface ShelfContextMenuContextBucketAdLib extends ShelfContextMenuContextBase {
	type: ContextType.BUCKET_ADLIB
	details: {
		bucket: Bucket
		adLib: BucketAdLibItem
	}
}

export interface ShelfContextMenuContextAdLib extends ShelfContextMenuContextBase {
	type: ContextType.ADLIB
	details: {
		adLib: AdLibPieceUi
	}
}

type ShelfContextMenuContext =
	| ShelfContextMenuContextBucket
	| ShelfContextMenuContextBucketAdLib
	| ShelfContextMenuContextAdLib

const shelfContextMenuContext: ReactiveVar<ShelfContextMenuContext | undefined> = new ReactiveVar(undefined)

export function setShelfContextMenuContext(context: ShelfContextMenuContext | undefined) {
	shelfContextMenuContext.set(context)
}

export default function ShelfContextMenu() {
	const { t } = useTranslation()

	const context = useTracker(() => {
		return shelfContextMenuContext.get()
	})

	const clearContext = () => {
		shelfContextMenuContext.set(undefined)
	}

	return (
		<ContextMenu id="shelf-context-menu" onHide={clearContext}>
			{context && context.type === ContextType.BUCKET && (
				<div className="react-contextmenu-label">{context.details.bucket.name}</div>
			)}
			{context && context.type === ContextType.BUCKET_ADLIB && (
				<>
					<div className="react-contextmenu-label">{context.details.adLib.name}</div>
					<MenuItem onClick={(e) => this.inspectBucketAdLib(e, context.details.adLib)}>
						{t('Inspect this AdLib')}
					</MenuItem>
					<MenuItem onClick={(e) => this.beginRenameBucketAdLib(context.details.adLib)}>
						{t('Rename this AdLib')}
					</MenuItem>
					<MenuItem onClick={(e) => this.deleteBucketAdLib(e, context.details.adLib)}>
						{t('Delete this AdLib')}
					</MenuItem>
					<hr />
				</>
			)}
			{context && (context.type === ContextType.BUCKET || context.type === ContextType.BUCKET_ADLIB) && (
				<>
					<MenuItem onClick={(e) => this.emptyBucket(e, context.details.bucket)}>{t('Empty this Bucket')}</MenuItem>
					<MenuItem onClick={(e) => this.renameBucket(context.details.bucket)}>{t('Rename this Bucket')}</MenuItem>
					<MenuItem onClick={(e) => this.deleteBucket(e, context.details.bucket)}>{t('Delete this Bucket')}</MenuItem>
					<hr />
				</>
			)}
			<MenuItem onClick={this.createNewBucket}>{t('Create new Bucket')}</MenuItem>
		</ContextMenu>
	)
}

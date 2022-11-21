import { ConfigManifestEntry } from '@sofie-automation/blueprints-integration'
import React, { forwardRef, useState, useImperativeHandle, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { ModalDialog } from '../../../lib/ModalDialog'

export interface DeleteItemModalProps {
	manifest: ConfigManifestEntry[]

	doDelete: (id: string) => void
}
export interface DeleteItemModalRef {
	show: (item: ConfigManifestEntry) => void
}
export const DeleteItemModal = forwardRef(function DeleteItemModal(
	{ manifest, doDelete }: DeleteItemModalProps,
	ref: React.ForwardedRef<DeleteItemModalRef>
) {
	const { t } = useTranslation()

	const [showForItem, setShowForItem] = useState<ConfigManifestEntry | null>(null)

	useImperativeHandle(ref, () => {
		return {
			show: (item: ConfigManifestEntry) => {
				setShowForItem(item)
			},
		}
	})

	const handleConfirmDeleteCancel = useCallback(() => {
		setShowForItem(null)
	}, [])

	const handleConfirmDeleteAccept = useCallback(() => {
		if (showForItem) {
			doDelete(showForItem.id)
		}

		setShowForItem(null)
	}, [showForItem, manifest])

	return (
		<ModalDialog
			title={t('Delete this item?')}
			acceptText={t('Delete')}
			secondaryText={t('Cancel')}
			show={!!showForItem}
			onAccept={handleConfirmDeleteAccept}
			onSecondary={handleConfirmDeleteCancel}
		>
			<p>
				{t('Are you sure you want to delete this config item "{{configId}}"?', {
					configId: showForItem?.name ?? '??',
				})}
			</p>
			<p>{t('Please note: This action is irreversible!')}</p>
		</ModalDialog>
	)
})

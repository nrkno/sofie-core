import { ConfigManifestEntry, IBlueprintConfig } from '@sofie-automation/blueprints-integration'
import { objectPathGet } from '@sofie-automation/corelib/dist/lib'
import React, { forwardRef, useState, useImperativeHandle, useMemo, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { DropdownInputOption, DropdownInputControl } from '../../../lib/Components/DropdownInput'
import { ModalDialog } from '../../../lib/ModalDialog'

export interface AddItemModalProps {
	manifest: ConfigManifestEntry[]
	config: IBlueprintConfig

	doCreate: (itemId: string, value: any) => void
}
export interface AddItemModalRef {
	show: () => void
}
export const AddItemModal = forwardRef(function AddItemModal(
	{ manifest, config, doCreate }: AddItemModalProps,
	ref: React.ForwardedRef<AddItemModalRef>
) {
	const { t } = useTranslation()

	const [show, setShow] = useState(false)
	const [selectedItem, setSelectedItem] = useState<string | null>(null)

	useImperativeHandle(ref, () => {
		return {
			show: () => {
				setShow(true)
			},
		}
	})

	const addOptions = useMemo(() => {
		let addOptions: DropdownInputOption<string>[] = []
		addOptions = manifest.map((c, i) => ({ value: c.id, name: c.name, i }))

		return addOptions.filter((o) => objectPathGet(config, o.value) === undefined)
	}, [manifest, config])

	useEffect(() => {
		// Make sure the selected is always valid
		setSelectedItem((id) => {
			const selected = addOptions.find((opt) => opt.value === id)
			if (selected) {
				return id
			} else {
				return addOptions[0]?.value
			}
		})
	}, [addOptions])

	const handleConfirmAddItemCancel = useCallback(() => {
		setShow(false)
		setSelectedItem(null)
	}, [])

	const handleConfirmAddItemAccept = useCallback(() => {
		const item = manifest.find((c) => c.id === selectedItem)
		if (selectedItem && item) {
			doCreate(item.id, item.defaultVal ?? '')
		}

		setShow(false)
		setSelectedItem(null)
	}, [selectedItem, manifest, doCreate])

	return (
		<ModalDialog
			title={t('Add config item')}
			acceptText={t('Add')}
			secondaryText={t('Cancel')}
			show={show}
			onAccept={handleConfirmAddItemAccept}
			onSecondary={handleConfirmAddItemCancel}
		>
			<div className="mod mvs mhs">
				<label className="field">
					{t('Item')}
					<div className="select focusable">
						<DropdownInputControl value={selectedItem ?? ''} options={addOptions} handleUpdate={setSelectedItem} />
					</div>
				</label>
			</div>
		</ModalDialog>
	)
})

import { Meteor } from 'meteor/meteor'
import * as React from 'react'
import { Bucket, BucketId } from '../../../lib/collections/Buckets'
import { BucketPanel } from './BucketPanel'
import { ShowStyleBase } from '../../../lib/collections/ShowStyleBases'

import { doUserAction } from '../../lib/userAction'
import { ClientAPI } from '../../../lib/api/client'

import { translate } from 'react-i18next'
import * as Escape from 'react-escape'
import * as faBars from '@fortawesome/fontawesome-free-solid/faBars'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { unprotectString, partial, literal } from '../../../lib/lib'
import { RundownPlaylist } from '../../../lib/collections/RundownPlaylists'
import { getElementDocumentOffset } from '../../utils/positions'
import { UIStateStorage } from '../../lib/UIStateStorage'
import { doModalDialog, ModalDialogQueueItem } from '../../lib/ModalDialog'
import { ContextMenu, MenuItem, ContextMenuTrigger } from 'react-contextmenu'
import { Translated } from '../../lib/ReactMeteorData/ReactMeteorData'

import { MeteorCall } from '../../../lib/api/methods'
import { DropTarget } from 'react-dnd'
import update from 'immutability-helper'

interface IBucketsProps {
	buckets: Bucket[] | undefined
	playlist: RundownPlaylist
	showStyleBase: ShowStyleBase
	shouldQueue: boolean
}

interface IState {
	panelWidths: number[]
	contextBucket: Bucket | undefined
	editedNameId: BucketId | undefined
	localBuckets: Bucket[]
}

export const RundownViewBuckets = translate()(
	class RundownViewBuckets extends React.Component<Translated<IBucketsProps>, IState> {
		private _mouseLast: {
			x: number
			y: number
		} = {
				x: 0,
				y: 0
			}
		private _mouseOffset: {
			x: number
			y: number
		} = {
				x: 0,
				y: 0
			}
		private _mouseDown: number
		private _targetBucket: Bucket | undefined

		constructor(props: Translated<IBucketsProps>) {
			super(props)

			this.state = {
				panelWidths: [],
				contextBucket: undefined,
				editedNameId: undefined,
				localBuckets: ([] as Bucket[]).concat(props.buckets || [])
			}
		}

		static getDerivedStateFromProps(props: IBucketsProps, state: IState) {
			return {
				panelWidths: props.buckets ?
					props.buckets.map((bucket, index) =>
						state.panelWidths[index] !== undefined ?
							state.panelWidths[index] :
							UIStateStorage.getItemNumber('rundownView.shelf.buckets', unprotectString(bucket._id),
								bucket.width !== undefined ? bucket.width : 0.2)
					) : []
			}
		}

		componentDidUpdate(prevProps: IBucketsProps) {
			if (this.props.buckets !== prevProps.buckets) {
				this.setState({
					localBuckets: ([] as Bucket[]).concat(this.props.buckets || []),
					panelWidths: (this.props.buckets || []).map((bucket) =>
						UIStateStorage.getItemNumber('rundownView.shelf.buckets', unprotectString(bucket._id),
							bucket.width !== undefined ? bucket.width : 0.2))
				})
			}
		}

		resize = (x: number, y: number) => {
			if (this.props.buckets && this._targetBucket) {
				const index = this.props.buckets.indexOf(this._targetBucket)
				if (index >= 0) {
					const panelWidths = ([] as number[]).concat(this.state.panelWidths)
					const delta = ((this._mouseLast.x - x) / window.innerWidth)
					const targetWidth = Math.min(1, Math.max(panelWidths[index] + delta, 0))
					panelWidths[index] = targetWidth
					if (index > 0 && targetWidth > 0) {
						panelWidths[index - 1] = Math.min(1, Math.max(panelWidths[index - 1] - delta, 0))
					}

					if (targetWidth > 0) {
						this._mouseLast.x = x
						this._mouseLast.y = y
					}

					this.setState({
						panelWidths
					})
				}
			}
		}

		endResize = () => {
			// Re-enable pointer-events on the iframes, until the resizing ends
			document.querySelectorAll('iframe').forEach(iframe => {
				iframe.style.pointerEvents = ''
			})

			if (this.props.buckets) {
				this.props.buckets.forEach((bucket, index) => {
					const width = this.state.panelWidths[index]
					UIStateStorage.setItem('rundownView.shelf.buckets', unprotectString(bucket._id), width)
				})
			}

			document.body.style.cursor = ''
		}

		beginResize = (x: number, y: number, targetBucket: Bucket, targetElement: HTMLElement) => {
			// Disable pointer-events on all iframes, until the resizing ends
			document.querySelectorAll('iframe').forEach(iframe => {
				iframe.style.pointerEvents = 'none'
			})

			this._mouseLast.x = x
			this._mouseLast.y = y

			const handlePosition = getElementDocumentOffset(targetElement)
			if (handlePosition) {
				this._mouseOffset.x = (handlePosition.left - window.scrollX) - this._mouseLast.x
				this._mouseOffset.y = (handlePosition.top - window.scrollY) - this._mouseLast.y
			}

			document.body.style.cursor = 'ew-resize'

			this._mouseDown = Date.now()

			this._targetBucket = targetBucket
		}

		touchMoveHandle = (e: TouchEvent) => {
			this.resize(e.touches[0].clientX, e.touches[0].clientY)
		}

		touchOffHandle = (e: TouchEvent) => {
			document.removeEventListener('touchmove', this.touchMoveHandle)
			document.removeEventListener('touchcancel', this.touchOffHandle)
			document.removeEventListener('touchend', this.touchOffHandle)

			this.endResize()
		}

		touchOnHandle = (e: React.TouchEvent<HTMLDivElement>, bucket: Bucket) => {
			document.addEventListener('touchmove', this.touchMoveHandle, {
				passive: false
			})
			document.addEventListener('touchcancel', this.touchOffHandle)
			document.addEventListener('touchend', this.touchOffHandle, {
				passive: false
			})

			if (e.touches.length > 1) {
				this.touchOffHandle(e.nativeEvent)
				return
			}

			e.preventDefault()

			this.beginResize(e.targetTouches[0].clientX, e.targetTouches[0].clientY, bucket, e.currentTarget)
		}

		dragHandle = (e: MouseEvent) => {
			if (e.buttons !== 1) {
				this.dropHandle(e)
				return
			}

			this.resize(e.clientX, e.clientY)
		}

		dropHandle = (e: MouseEvent) => {
			document.removeEventListener('mouseup', this.dropHandle)
			document.removeEventListener('mouseleave', this.dropHandle)
			document.removeEventListener('mousemove', this.dragHandle)

			this.endResize()
		}

		grabHandle = (e: React.MouseEvent<HTMLDivElement>, bucket: Bucket) => {
			if (e.button !== 0) {
				return
			}

			document.addEventListener('mouseup', this.dropHandle)
			document.addEventListener('mouseleave', this.dropHandle)
			document.addEventListener('mousemove', this.dragHandle)

			e.preventDefault()

			this.beginResize(e.clientX, e.clientY, bucket, e.currentTarget)
		}

		clearContextBucket = () => {
			this.setState({
				contextBucket: undefined
			})
		}

		createNewBucket = (e: any) => {
			const { t } = this.props

			if (e.persist) e.persist()

			doUserAction(t, e, 'New Bucket', (e) => MeteorCall.userAction.bucketsCreateNewBucket(e, t('New Bucket'), this.props.playlist.studioId, null), (_err, res) => {
				if (ClientAPI.isClientResponseSuccess(res)) {
					this.setState({
						editedNameId: (res.result as Bucket)._id
					})
				}
			}
			)
		}

		deleteBucket = (e: any, bucket: Bucket) => {
			const { t } = this.props

			if (e.persist) e.persist()

			doModalDialog(literal<ModalDialogQueueItem>({
				message: t('Are you sure you want to delete this Bucket?'),
				title: bucket.name,
				onAccept: () => {
					doUserAction(t, e, 'Remove Bucket', (e) => MeteorCall.userAction.bucketsRemoveBucket(e, bucket._id))
				}
			}))
		}

		renameBucket = (bucket: Bucket) => {
			this.setState({
				editedNameId: bucket._id
			})
		}

		emptyBucket = () => {

		}

		finishRenameBucket = (e: any, bucket: Bucket, newName: string) => {
			const { t } = this.props

			this.setState({
				editedNameId: undefined
			})

			if (e.persist) e.persist()

			doUserAction(t, e, 'Modify Bucket', (e) => MeteorCall.userAction.bucketsModifyBucket(e, bucket._id, partial<Bucket>({
				name: newName
			})))
		}

		private moveBucket = (id: BucketId, atIndex: number) => {
			const { bucket, index } = this.findBucket(id)
			const panelWidth = this.state.panelWidths[index]

			if (bucket) {
				this.setState(
					update(this.state, {
						localBuckets: {
							$splice: [[index, 1], [atIndex, 0, bucket] as any]
						},
						panelWidths: {
							$splice: [[index, 1], [atIndex, 0, panelWidth] as any]
						}
					})
				)
			}
		}

		private findBucket = (id: BucketId) => {
			const { localBuckets: buckets } = this.state
			const bucket = buckets.find(b => b._id === id)

			return {
				bucket,
				index: bucket ? buckets.indexOf(bucket) : -1
			}
		}

		private onBucketReorder = (draggedId: BucketId, newIndex: number) => {
			const { t } = this.props
			if (this.props.buckets) {
				const draggedB = this.props.buckets.find(b => b._id === draggedId)

				if (draggedB) {
					let newRank = draggedB._rank

					// Dragged over into first place
					if (newIndex === 0) {
						newRank = this.props.buckets[0]._rank - 1
						// Dragged over into last place
					} else if (newIndex === this.props.buckets.length - 1) {
						newRank = this.props.buckets[this.props.buckets.length - 1]._rank + 1
						// Dragged into any other place
					} else {
						newRank = (this.props.buckets[newIndex]._rank + this.props.buckets[newIndex + 1]._rank) / 2
					}

					doUserAction(t, { type: 'drop' }, 'Modify Bucket', (e) => MeteorCall.userAction.bucketsModifyBucket(e, draggedB._id, partial<Bucket>({
						_rank: newRank
					})))
				}
			}
		}

		render() {
			const { playlist, showStyleBase, shouldQueue, t } = this.props
			const { localBuckets: buckets } = this.state
			return <>
				<Escape to='document'>
					<ContextMenu id='bucket-context-menu' onHide={this.clearContextBucket}>
						{this.state.contextBucket &&
							<div className='react-contextmenu-label'>
								{this.state.contextBucket.name}
							</div>}
						<MenuItem onClick={(e) => { }} disabled={!this.state.contextBucket}>
							{t('Empty this Bucket')}
						</MenuItem>
						<MenuItem
							onClick={(e) => this.state.contextBucket && this.renameBucket(this.state.contextBucket)}
							disabled={!this.state.contextBucket}
						>
							{t('Rename this Bucket')}
						</MenuItem>
						<MenuItem
							onClick={(e) => this.state.contextBucket && this.deleteBucket(e, this.state.contextBucket)}
							disabled={!this.state.contextBucket}
						>
							{t('Delete this Bucket')}
						</MenuItem>
						<hr />
						<MenuItem onClick={this.createNewBucket}>
							{t('Create new Bucket')}
						</MenuItem>
					</ContextMenu>
				</Escape >
				{buckets && buckets.map((bucket, index) =>
					<div className='rundown-view__shelf__contents__pane'
						key={unprotectString(bucket._id)}
						style={{
							minWidth: (this.state.panelWidths[index] * 100) + 'vw'
						}}
					>
						<div className='rundown-view__shelf__contents__pane__divider'
							onMouseDown={(e) => this.grabHandle(e, bucket)}
							onTouchStart={(e) => this.touchOnHandle(e, bucket)}>
							<div className='rundown-view__shelf__contents__pane__handle'>
								<FontAwesomeIcon icon={faBars} />
							</div>
							<ContextMenuTrigger id='bucket-context-menu' collect={() => new Promise((resolve) => {
								this.setState({
									contextBucket: bucket
								}, resolve)
							})}>
								{this.state.panelWidths[index] > 0 &&
									<BucketPanel
										playlist={playlist}
										showStyleBase={showStyleBase}
										shouldQueue={shouldQueue}
										bucket={bucket}
										editableName={this.state.editedNameId === bucket._id}
										onNameChanged={(e, name) => this.finishRenameBucket(e, bucket, name)}
										moveBucket={this.moveBucket}
										findBucket={this.findBucket}
										onBucketReorder={this.onBucketReorder}
									/>
								}
							</ContextMenuTrigger>
						</div>
					</div>
				)}
			</>
		}
	})

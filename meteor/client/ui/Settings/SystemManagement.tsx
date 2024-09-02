import React, { useCallback, useMemo } from 'react'
import { useTracker, useSubscription } from '../../lib/ReactMeteorData/ReactMeteorData'
import { ICoreSystem, SofieLogo } from '../../../lib/collections/CoreSystem'
import { MeteorPubSub } from '../../../lib/api/pubsub'
import { EditAttribute } from '../../lib/EditAttribute'
import { doModalDialog } from '../../lib/ModalDialog'
import { MeteorCall } from '../../../lib/api/methods'
import { languageAnd } from '../../lib/language'
import { TriggeredActionsEditor } from './components/triggeredActions/TriggeredActionsEditor'
import { TFunction, useTranslation } from 'react-i18next'
import { Meteor } from 'meteor/meteor'
import { LogLevel } from '../../../lib/lib'
import { CoreSystem } from '../../collections'
import { CollectionCleanupResult } from '../../../lib/api/system'
import { LabelActual } from '../../lib/Components/LabelAndOverrides'
import { catchError } from '../../lib/lib'

interface WithCoreSystemProps {
	coreSystem: ICoreSystem | undefined
}

export default function SystemManagement(): JSX.Element | null {
	useSubscription(MeteorPubSub.coreSystem)

	const coreSystem = useTracker(() => CoreSystem.findOne(), [])
	const emptyObject = useMemo(() => ({}), [])

	if (!coreSystem) return null
	return (
		<div className="studio-edit mod mhl mvn">
			<SystemManagementGeneral coreSystem={coreSystem} />

			<SystemManagementNotificationMessage coreSystem={coreSystem} />

			<SystemManagementSupportPanel coreSystem={coreSystem} />

			<SystemManagementEvaluationsMessage coreSystem={coreSystem} />

			<div className="row">
				<div className="col c12 r1-c12">
					<TriggeredActionsEditor showStyleBaseId={null} sourceLayers={emptyObject} outputLayers={emptyObject} />
				</div>
			</div>

			<SystemManagementMonitoring coreSystem={coreSystem} />

			<SystemManagementCronJobs coreSystem={coreSystem} />

			<SystemManagementCleanup />
			<SystemManagementHeapSnapshot />
		</div>
	)
}

function SystemManagementGeneral({ coreSystem }: Readonly<WithCoreSystemProps>) {
	const { t } = useTranslation()

	return (
		<>
			<h2 className="mhn mtn">{t('General')}</h2>
			<div className="properties-grid">
				<label className="field">
					<LabelActual label={t('Installation name')} />
					<div className="mdi">
						<EditAttribute
							modifiedClassName="bghl"
							attribute="name"
							obj={coreSystem}
							type="text"
							collection={CoreSystem}
							className="mdinput"
						/>
						<span className="mdfx"></span>
					</div>
					<span className="text-s dimmed field-hint">
						{t('This name will be shown in the title bar of the window')}
					</span>
				</label>
				<label className="field">
					<LabelActual label={t('Logo')} />
					<div className="mdi">
						<EditAttribute
							modifiedClassName="bghl"
							attribute="logo"
							obj={coreSystem}
							type="dropdown"
							options={{ ...SofieLogo }}
							collection={CoreSystem}
							className="mdinput"
						/>
					</div>
					<span className="text-s dimmed field-hint">
						{t('Sofie logo to be displayed in the header. Requires a page refresh.')}
					</span>
				</label>
				<label className="field">
					<LabelActual label={t('Logging level')} />
					<div className="mdi">
						<EditAttribute
							modifiedClassName="bghl"
							attribute="logLevel"
							obj={coreSystem}
							type="dropdown"
							options={{ ...LogLevel, 'Use fallback': undefined }}
							collection={CoreSystem}
							className="mdinput"
						/>
						<span className="mdfx"></span>
					</div>
					<span className="text-s dimmed field-hint">
						{t('This affects how much is logged to the console on the server')}
					</span>
				</label>
			</div>
		</>
	)
}

function SystemManagementNotificationMessage({ coreSystem }: Readonly<WithCoreSystemProps>) {
	const { t } = useTranslation()

	return (
		<>
			<h2 className="mhn mtn">{t('System-wide Notification Message')}</h2>
			<div className="properties-grid">
				<label className="field">
					<LabelActual label={t('Message')} />
					<div className="mdi">
						<EditAttribute
							modifiedClassName="bghl"
							attribute="systemInfo.message"
							obj={coreSystem}
							type="text"
							collection={CoreSystem}
							className="mdinput"
						/>
						<span className="mdfx"></span>
					</div>
				</label>
				<label className="field">
					<LabelActual label={t('Enabled')} />
					<div className="mdi">
						<EditAttribute
							attribute="systemInfo.enabled"
							obj={coreSystem}
							type="checkbox"
							collection={CoreSystem}
						></EditAttribute>
					</div>
				</label>
			</div>
		</>
	)
}

function SystemManagementSupportPanel({ coreSystem }: Readonly<WithCoreSystemProps>) {
	const { t } = useTranslation()

	return (
		<>
			<h2 className="mhn mtn">{t('Support Panel')}</h2>
			<div className="properties-grid">
				<label className="field">
					<LabelActual label={t('Edit Support Panel')} />
					<div className="mdi">
						<EditAttribute
							modifiedClassName="bghl"
							attribute="support.message"
							obj={coreSystem}
							type="multiline"
							collection={CoreSystem}
							className="mdinput"
						/>
						<span className="mdfx"></span>
					</div>
					<span className="text-s dimmed field-hint">{t('HTML that will be shown in the Support Panel')}</span>
				</label>
			</div>
		</>
	)
}

function SystemManagementEvaluationsMessage({ coreSystem }: Readonly<WithCoreSystemProps>) {
	const { t } = useTranslation()

	return (
		<>
			<h2 className="mhn mtn">{t('Evaluations')}</h2>
			<div className="properties-grid">
				<label className="field">
					<LabelActual label={t('Heading')} />
					<div className="mdi">
						<EditAttribute
							modifiedClassName="bghl"
							attribute="evaluations.heading"
							obj={coreSystem}
							type="text"
							collection={CoreSystem}
							className="mdinput"
						/>
						<span className="mdfx"></span>
					</div>
				</label>
				<label className="field">
					<LabelActual label={t('Message')} />
					<div className="mdi">
						<EditAttribute
							modifiedClassName="bghl"
							attribute="evaluations.message"
							obj={coreSystem}
							type="multiline"
							collection={CoreSystem}
							className="mdinput"
						/>
						<span className="mdfx"></span>
					</div>
					<span className="text-s dimmed field-hint">{t('Message shown to users in the Evaluations form')}</span>
				</label>
				<label className="field">
					<LabelActual label={t('Enabled')} />
					<div className="mdi">
						<EditAttribute
							attribute="evaluations.enabled"
							obj={coreSystem}
							type="checkbox"
							collection={CoreSystem}
						></EditAttribute>
					</div>
				</label>
			</div>
		</>
	)
}

function SystemManagementMonitoring({ coreSystem }: Readonly<WithCoreSystemProps>) {
	const { t } = useTranslation()

	return (
		<>
			<h2 className="mhn">{t('Application Performance Monitoring')}</h2>
			<div className="properties-grid">
				<label className="field">
					<LabelActual label={t('APM Enabled')} />
					<div className="mdi">
						<EditAttribute
							attribute="apm.enabled"
							obj={coreSystem}
							type="checkbox"
							collection={CoreSystem}
						></EditAttribute>
					</div>
				</label>
				<label className="field">
					<LabelActual label={t('APM Transaction Sample Rate')} />
					<div className="mdi">
						<EditAttribute
							modifiedClassName="bghl"
							attribute="apm.transactionSampleRate"
							obj={coreSystem}
							type="float"
							collection={CoreSystem}
							className="mdinput"
						/>
						<span className="mdfx"></span>
					</div>
					<span className="text-s dimmed field-hint">
						{t(
							'How many of the transactions to monitor. Set to -1 to log nothing (max performance), 0.5 to log 50% of the transactions, 1 to log all transactions'
						)}
					</span>
					<span className="text-s dimmed field-hint">
						{t('Note: Core needs to be restarted to apply these settings')}
					</span>
				</label>
			</div>

			<div className="properties-grid">
				<label className="field">
					<LabelActual label={t('Monitor blocked thread')} />
					<div className="mdi">
						<EditAttribute
							modifiedClassName="bghl"
							attribute="enableMonitorBlockedThread"
							obj={coreSystem}
							type="checkbox"
							collection={CoreSystem}
							className="mdinput"
						/>
						<span className="mdfx"></span>
					</div>
					<span className="text-s dimmed field-hint">
						{t(
							'Enables internal monitoring of blocked main thread. Logs when there is an issue, but (unverified) might cause issues in itself.'
						)}
					</span>
				</label>
			</div>

			<div>{t('Note: Core needs to be restarted to apply these settings')}</div>
		</>
	)
}

function SystemManagementCronJobs({ coreSystem }: Readonly<WithCoreSystemProps>) {
	const { t } = useTranslation()

	return (
		<>
			<h2 className="mhn">{t('Cron jobs')}</h2>
			<div className="properties-grid">
				<label className="field">
					<LabelActual label={t('Enable CasparCG restart job')} />
					<div className="mdi">
						<EditAttribute
							attribute="cron.casparCGRestart.enabled"
							obj={coreSystem}
							type="checkbox"
							collection={CoreSystem}
						></EditAttribute>
					</div>
				</label>
				<label className="field">
					<LabelActual label={t('Enable automatic storage of Rundown Playlist snapshots periodically')} />
					<div className="mdi">
						<EditAttribute
							attribute="cron.storeRundownSnapshots.enabled"
							obj={coreSystem}
							type="checkbox"
							collection={CoreSystem}
						></EditAttribute>
					</div>
				</label>
				<label className="field">
					<LabelActual label={t('Filter: If set, only store snapshots for certain rundowns')} />
					<div className="mdi">
						<EditAttribute
							modifiedClassName="bghl"
							attribute="cron.storeRundownSnapshots.rundownNames"
							obj={coreSystem}
							type="text"
							collection={CoreSystem}
							className="mdinput"
							label="Rundown Playlist names"
							mutateDisplayValue={(v: string[] | undefined) =>
								v === undefined || v.length === 0 ? undefined : v.join(', ')
							}
							mutateUpdateValue={(v: string | undefined) =>
								v === undefined || v.length === 0 ? undefined : v.split(',').map((i) => i.trim())
							}
						/>
					</div>
					<span className="text-s dimmed field-hint">
						{t('(Comma separated list. Empty - will store snapshots of all Rundown Playlists)')}
					</span>
				</label>
			</div>
		</>
	)
}

function SystemManagementCleanup() {
	const { t } = useTranslation()

	const localCheckForOldDataAndCleanUp = useCallback(() => {
		checkForOldDataAndCleanUp(t)
	}, [t])

	const cleanUpOldDatabaseIndexes = useCallback(() => {
		MeteorCall.system
			.cleanupIndexes(false)
			.then((indexesToRemove) => {
				console.log(indexesToRemove)
				doModalDialog({
					title: t('Remove indexes'),
					message: t('This will remove {{indexCount}} old indexes, do you want to continue?', {
						indexCount: indexesToRemove.length,
					}),
					yes: t('Yes'),
					no: t('No'),
					onAccept: () => {
						MeteorCall.system
							.cleanupIndexes(true)
							.then((indexesRemoved) => {
								doModalDialog({
									title: t('Remove indexes'),
									message: t('{{indexCount}} indexes was removed.', {
										indexCount: indexesRemoved.length,
									}),
									acceptOnly: true,
									onAccept: () => {
										// nothing
									},
								})
							})
							.catch(catchError('system.cleanupIndexes'))
					},
				})
			})
			.catch(catchError('system.cleanupIndexes'))
	}, [t])

	return (
		<>
			<h2 className="mhn">{t('Cleanup')}</h2>
			<div>
				<button className="btn btn-default" onClick={cleanUpOldDatabaseIndexes}>
					{t('Cleanup old database indexes')}
				</button>
			</div>
			<div>
				<button className="btn btn-default" onClick={localCheckForOldDataAndCleanUp}>
					{t('Cleanup old data')}
				</button>
			</div>
		</>
	)
}

export function checkForOldDataAndCleanUp(t: TFunction, retriesLeft = 0): void {
	MeteorCall.system
		.cleanupOldData(false)
		.then((results) => {
			if (typeof results === 'string') {
				if (retriesLeft <= 0) {
					doModalDialog({
						title: t('Error when checking for cleaning up'),
						message: results,
						acceptOnly: true,
						onAccept: () => {
							// nothing
						},
					})
				} else {
					// Try again:
					Meteor.setTimeout(() => {
						checkForOldDataAndCleanUp(t, retriesLeft - 1)
					}, 300)
				}
			} else {
				const collections = Object.values<CollectionCleanupResult[0]>(results).filter((o) => o.docsToRemove > 0)
				collections.sort((a, b) => {
					return a.docsToRemove - b.docsToRemove
				})

				let totalCount = 0
				const affectedCollections: string[] = []
				for (const result of Object.values<CollectionCleanupResult['0']>(results)) {
					totalCount += result.docsToRemove
					if (result.docsToRemove > 0) {
						affectedCollections.push(result.collectionName)
					}
				}
				if (totalCount) {
					doModalDialog({
						title: t('Remove old data from database'),
						message: (
							<React.Fragment>
								<p>
									{t('There are {{count}} documents that can be removed, do you want to continue?', {
										count: totalCount,
										collections: languageAnd(t, affectedCollections),
									})}
								</p>
								<p>
									{t('Documents to be removed:')}
									<ul>
										{collections.map((o, index) => {
											return (
												<li key={index}>
													{o.collectionName}: {o.docsToRemove}
												</li>
											)
										})}
									</ul>
								</p>
							</React.Fragment>
						),

						yes: t('Yes'),
						no: t('No'),
						onAccept: () => {
							MeteorCall.system
								.cleanupOldData(true)
								.then((results) => {
									console.log(results)

									if (typeof results === 'string') {
										doModalDialog({
											title: t('Error'),
											message: results,
											acceptOnly: true,
											onAccept: () => {
												checkForOldDataAndCleanUp(t, retriesLeft)
											},
											yes: t('Retry'),
											no: t('Cancel'),
										})
									} else {
										doModalDialog({
											title: t('Remove old data'),
											message: t('The old data was removed.'),
											acceptOnly: true,
											onAccept: () => {
												// nothing
											},
										})
									}
								})
								.catch(catchError('system.cleanupOldData'))
						},
					})
				} else {
					doModalDialog({
						title: t('Remove old data from database'),
						message: t('Nothing to cleanup!'),
						acceptOnly: true,
						onAccept: () => {
							// nothing
						},
					})
				}
			}
		})
		.catch(catchError('system.cleanupOldData'))
}
function SystemManagementHeapSnapshot() {
	const { t } = useTranslation()

	const [displayWarning, setDisplayWarning] = React.useState(false)
	const [active, setActive] = React.useState(false)

	const onAreYouSure = useCallback(() => {
		setDisplayWarning(true)
	}, [])
	const onReset = useCallback(() => {
		setDisplayWarning(false)
		setActive(false)
	}, [])
	const onConfirm = useCallback(() => {
		setActive(true)
		setTimeout(() => setActive(false), 20000)
	}, [])
	return (
		<>
			<h2 className="mhn">{t('Memory troubleshooting')}</h2>
			<div>
				{active ? (
					<span>{t('Preparing, please wait...')}</span>
				) : displayWarning ? (
					<>
						<div>{t(`Are you sure? This will cause the whole Sofie system to be unresponsive several seconds!`)}</div>

						<a className="btn btn-primary" href="/api/private/heapSnapshot/retrieve?areYouSure=yes" onClick={onConfirm}>
							{t(`Yes, Take and Download Memory Heap Snapshot`)}
						</a>
						<button className="btn btn-default" onClick={onReset}>
							{t(`No`)}
						</button>
					</>
				) : (
					<button className="btn btn-primary" onClick={onAreYouSure}>
						{t(`Take and Download Memory Heap Snapshot`)}
					</button>
				)}
			</div>
			<div>
				<span className="text-s dimmed field-hint">
					{t('To inspect the memory heap snapshot, use Chrome DevTools')}
				</span>
			</div>
		</>
	)
}

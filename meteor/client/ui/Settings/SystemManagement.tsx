import * as React from 'react'
import { translateWithTracker, Translated } from '../../lib/ReactMeteorData/ReactMeteorData'
import { ICoreSystem, CoreSystem } from '../../../lib/collections/CoreSystem'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import { meteorSubscribe, PubSub } from '../../../lib/api/pubsub'
import { EditAttribute } from '../../lib/EditAttribute'
import { doModalDialog } from '../../lib/ModalDialog'
import { MeteorCall } from '../../../lib/api/methods'
import * as _ from 'underscore'
import { languageAnd } from '../../lib/language'
import { TriggeredActionsEditor } from './components/triggeredActions/TriggeredActionsEditor'
import { TFunction } from 'i18next'
import { Meteor } from 'meteor/meteor'
import { LogLevel } from '../../../lib/lib'

interface IProps {}

interface ITrackedProps {
	coreSystem: ICoreSystem | undefined
}

export default translateWithTracker<IProps, {}, ITrackedProps>((_props: IProps) => {
	return {
		coreSystem: CoreSystem.findOne(),
	}
})(
	class SystemManagement extends MeteorReactComponent<Translated<IProps & ITrackedProps>> {
		componentDidMount() {
			meteorSubscribe(PubSub.coreSystem)
		}
		cleanUpOldDatabaseIndexes(): void {
			const { t } = this.props
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
								.catch(console.error)
						},
					})
				})
				.catch(console.error)
		}
		render() {
			const { t } = this.props

			return this.props.coreSystem ? (
				<div className="studio-edit mod mhl mvn">
					<div>
						<h2 className="mhn mtn">{t('Installation name')}</h2>
						<label className="field">
							{t('This name will be shown in the title bar of the window')}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="name"
									obj={this.props.coreSystem}
									type="text"
									collection={CoreSystem}
									className="mdinput"
								/>
								<span className="mdfx"></span>
							</div>
						</label>

						<h2 className="mhn mtn">{t('Logging level')}</h2>
						<label className="field">
							{t('This affects how much is logged to the console on the server')}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="logLevel"
									obj={this.props.coreSystem}
									type="dropdown"
									options={{ ...LogLevel, 'Use fallback': undefined }}
									collection={CoreSystem}
									className="mdinput"
								/>
								<span className="mdfx"></span>
							</div>
						</label>

						<h2 className="mhn mtn">{t('System-wide Notification Message')}</h2>
						<label className="field">
							{t('Message')}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="systemInfo.message"
									obj={this.props.coreSystem}
									type="text"
									collection={CoreSystem}
									className="mdinput"
								/>
								<span className="mdfx"></span>
							</div>
						</label>
						<div className="field">
							{t('Enabled')}
							<div className="mdi">
								<EditAttribute
									attribute="systemInfo.enabled"
									obj={this.props.coreSystem}
									type="checkbox"
									collection={CoreSystem}
								></EditAttribute>
							</div>
						</div>

						<h2 className="mhn">{t('Edit Support Panel')}</h2>
						<label className="field">
							{t('HTML that will be shown in the Support Panel')}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="support.message"
									obj={this.props.coreSystem}
									type="multiline"
									collection={CoreSystem}
									className="mdinput"
								/>
								<span className="mdfx"></span>
							</div>
						</label>

						<div className="row">
							<div className="col c12 r1-c12">
								<TriggeredActionsEditor showStyleBaseId={null} sourceLayers={{}} outputLayers={{}} />
							</div>
						</div>

						<h2 className="mhn">{t('Application Performance Monitoring')}</h2>
						<div className="field">
							{t('APM Enabled')}
							<div className="mdi">
								<EditAttribute
									attribute="apm.enabled"
									obj={this.props.coreSystem}
									type="checkbox"
									collection={CoreSystem}
								></EditAttribute>
							</div>
						</div>
						<label className="field">
							{t('APM Transaction Sample Rate')}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="apm.transactionSampleRate"
									obj={this.props.coreSystem}
									type="float"
									collection={CoreSystem}
									className="mdinput"
								/>
								<span className="mdfx"></span>
							</div>
							<div>
								(
								{t(
									'How many of the transactions to monitor. Set to -1 to log nothing (max performance), 0.5 to log 50% of the transactions, 1 to log all transactions'
								)}
								)
							</div>
							<div>{t('Note: Core needs to be restarted to apply these settings')}</div>
						</label>

						<h2 className="mhn">{t('Monitor blocked thread')}</h2>

						<label className="field">
							{t('Enable')}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="enableMonitorBlockedThread"
									obj={this.props.coreSystem}
									type="checkbox"
									collection={CoreSystem}
									className="mdinput"
								/>
								<span className="mdfx"></span>
							</div>
							<div>
								(
								{t(
									'Enables internal monitoring of blocked main thread. Logs when there is an issue, but (unverified) might cause issues in itself.'
								)}
								)
							</div>
						</label>

						<div>{t('Note: Core needs to be restarted to apply these settings')}</div>

						<h2 className="mhn">{t('Cron jobs')}</h2>
						<div className="field">
							{t('Enable CasparCG restart job')}
							<div className="mdi">
								<EditAttribute
									attribute="cron.casparCGRestart.enabled"
									obj={this.props.coreSystem}
									type="checkbox"
									collection={CoreSystem}
								></EditAttribute>
							</div>
						</div>

						<h2 className="mhn">{t('Cleanup')}</h2>
						<div>
							<button className="btn btn-default" onClick={() => this.cleanUpOldDatabaseIndexes()}>
								{t('Cleanup old database indexes')}
							</button>
						</div>
						<div>
							<button className="btn btn-default" onClick={() => checkForOldDataAndCleanUp(t)}>
								{t('Cleanup old data')}
							</button>
						</div>

						<h2 className="mhn">{t('Cron jobs')}</h2>
						<div className="field">
							{t('Disable CasparCG restart job')}
							<div className="mdi">
								<EditAttribute
									attribute="cron.casparCG.disabled"
									obj={this.props.coreSystem}
									type="checkbox"
									collection={CoreSystem}
								></EditAttribute>
							</div>
						</div>
						<div className="field">
							{t('Enable automatic storage of Rundown Playlist snapshots periodically')}
							<div className="mdi">
								<EditAttribute
									attribute="cron.storeRundownSnapshots.enabled"
									obj={this.props.coreSystem}
									type="checkbox"
									collection={CoreSystem}
								></EditAttribute>
							</div>
							{t('Filter: If set, only store snapshots for certain rundowns')}
							<div className="mdi">
								<EditAttribute
									modifiedClassName="bghl"
									attribute="cron.storeRundownSnapshots.rundownNames"
									obj={this.props.coreSystem}
									type="text"
									collection={CoreSystem}
									className="mdinput"
									label="Rundown Playlist names"
									mutateDisplayValue={(v) => (v === undefined || v.length === 0 ? undefined : v.join(', '))}
									mutateUpdateValue={(v) =>
										v === undefined || v.length === 0 ? undefined : v.split(',').map((i) => i.trim())
									}
								/>
							</div>
							<div>{t('(Comma separated list. Empty - will store snapshots of all Rundown Playlists)')}</div>
						</div>
					</div>
				</div>
			) : null
		}
	}
)

export function checkForOldDataAndCleanUp(t: TFunction, retriesLeft: number = 0): void {
	MeteorCall.system
		.cleanupOldData(false)
		.then((results) => {
			console.log(results)
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
				const collections = Object.values(results).filter((o) => o.docsToRemove > 0)
				collections.sort((a, b) => {
					return a.docsToRemove - b.docsToRemove
				})

				let totalCount = 0
				const affectedCollections: string[] = []
				_.each(results, (result) => {
					totalCount += result.docsToRemove
					if (result.docsToRemove > 0) {
						affectedCollections.push(result.collectionName)
					}
				})
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

									if (_.isString(results)) {
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
								.catch(console.error)
						},
					})
				}
			}
		})
		.catch(console.error)
}

import * as React from 'react'
import { Translated, translateWithTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { ModalDialog } from '../../lib/ModalDialog'
import { MeteorReactComponent } from '../../lib/MeteorReactComponent'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
import { faBinoculars } from '@fortawesome/fontawesome-free-solid'
import { Meteor } from 'meteor/meteor'
import { logger } from '../../../lib/logging'
import {
	MigrationMethods,
	GetMigrationStatusResultMigrationNeeded,
	GetMigrationStatusResult,
	MigrationStepInput,
	MigrationStepInputResult,
	RunMigrationResult
} from '../../../lib/api/migration'
import * as _ from 'underscore';
import { EditAttribute, EditAttributeBase } from '../../lib/EditAttribute';

interface IProps {
}
interface IState {
	systemVersion: string
	databaseVersion: string
	migrationNeeded: boolean

	migration?: {
		canDoAutomaticMigration: boolean
		manualInputs: Array<MigrationStepInput>
		hash: string
		baseVersion: string
		targetVersion: string
		automaticStepCount: number
		manualStepCount: number
	},
	warnings: Array<string>,
	migrationCompleted: boolean
}
interface ITrackedProps {
}
export const MigrationView = translateWithTracker<IProps, IState, ITrackedProps>((props: IProps) => {
	return {
	}
})( class MigrationView extends MeteorReactComponent<Translated<IProps & ITrackedProps>, IState> {
	private _inputValues: {
		[stepId: string]: {
			[attribute: string]: any
		}
	} = {}
	constructor (props: Translated<IProps & ITrackedProps>) {
		super(props)
		this.state = {
			systemVersion: '-',
			databaseVersion: '-',
			migrationNeeded: false,
			warnings: [],
			migrationCompleted: false
		}
	}
	componentDidMount () {
		this.updateVersions()
	}
	updateVersions () {
		this.setState({
			systemVersion: '-',
			databaseVersion: '-',
			migrationNeeded: false
		})

		Meteor.call(MigrationMethods.getMigrationStatus, (err, r: GetMigrationStatusResult) => {
			if (err) {
				logger.error(err)
				// todo: notify user
			} else {
				console.log(r)
				this.setState({
					systemVersion: r.systemVersion,
					databaseVersion: r.databaseVersion,
					migrationNeeded: r.migrationNeeded
				})
				if (r.migrationNeeded) {

					let result = r as GetMigrationStatusResultMigrationNeeded

					this.setState({
						migration: result.migration
					})

				}
			}
		})
	}
	runMigration () {

		let inputResults: Array<MigrationStepInputResult> = []

		_.each(this._inputValues, (iv, stepId: string) => {
			_.each(iv, (value: any, attribute: string) => {
				inputResults.push({
					stepId: stepId,
					attribute: attribute,
					value: value
				})
			})
		})
		if (this.state.migration) {
			Meteor.call(MigrationMethods.runMigration,
				this.state.migration.baseVersion, // baseVersionStr
				this.state.migration.targetVersion, // targetVersionStr
				this.state.migration.hash, // hash
				inputResults, // inputResults
			(err, r: RunMigrationResult) => {
				if (err) {
					logger.error(err)
					// todo: notify user
				} else {
					this.setState({
						warnings: r.warnings,
						migrationCompleted: r.migrationCompleted
					})

					this.updateVersions()
				}
			})
		}
	}
	renderManualSteps () {
		if (this.state.migration) {
			return _.map(this.state.migration.manualInputs, (manualInput: MigrationStepInput) => {
				if (manualInput.stepId) {
					let stepId = manualInput.stepId
					return (<div>
						<label>{manualInput.label}</label>
						<div>{manualInput.description}</div>
						<div>
							<EditAttribute
								type={manualInput.inputType}
								updateFunction={(edit: EditAttributeBase, newValue: any ) => {
									if (!this._inputValues[stepId]) this._inputValues[stepId] = {}
									this._inputValues[stepId][manualInput.attribute] = newValue
								}}
							/>
						</div>
					</div>)
				} else {
					return null
				}
			})
		}
	}
	render () {
		const { t } = this.props

		return (
			<div className='studio-edit mod mhl mvs'>
				<div>

					<div>
						<div>
							System version: {this.state.systemVersion}
						</div>
						<div>
							Database version: {this.state.databaseVersion}
						</div>
						<div>
							<button className='btn mod mhm' onClick={() => { this.updateVersions() }}>
								<FontAwesomeIcon icon={faBinoculars} />
								{t('Refresh')}
							</button>
						</div>
					</div>
					{this.state.migrationNeeded && this.state.migration ?
						<div>
							<h3>Migrate database, from {this.state.migration.baseVersion} to {this.state.migration.targetVersion}</h3>

							{this.state.migration.canDoAutomaticMigration ?
								<div>
									<div>
										{t('Database migration can be done automatically.')}
									</div>
									<button className='btn-primary' onClick={() => { this.runMigration() }}>
										<FontAwesomeIcon icon={faBinoculars} />
										{t('Run automatic migration procedure')}
									</button>
								</div>
							:
							<div>
								<div>
									{t('The migration procedure has some manual steps, see below:')}
								</div>
								<div>
									{this.renderManualSteps()}
								</div>
								<button className='btn-primary' onClick={() => { this.runMigration() }}>
									<FontAwesomeIcon icon={faBinoculars} />
									{t('Run migration procedure')}
								</button>
							</div>
							}
						</div>
					: null}

					{this.state.migrationCompleted ?
						<div>
							{t('The migration has completed successfully!')}
						</div>
					: null

					}

					{/* <button className='action-btn mod mhm' onClick={() => { this.checkMigration() }}>
						<FontAwesomeIcon icon={faBinoculars} />
						Check migration

					</button> */}

					{/* <label className='field'>
						{t('Restore Backup')}
						<div className='mdi'>
							<input type='file' accept='.json' onChange={this.onUploadFile.bind(this)} key={this.state.uploadFileKey} />
							<span className='mdfx'></span>
						</div>
					</label>
					<ModalDialog title={t('Restore this backup?')} acceptText={t('Restore')} secondaryText={t('Cancel')} show={this.state.showUploadConfirm} onAccept={() => this.handleConfirmUploadFileAccept()} onSecondary={() => this.handleConfirmUploadFileCancel()}>
						<p>{t('Are you sure you want to restore the backup file "{{fileName}}"?', { fileName: this.state.uploadFileName })}</p>
						<p>{t('Please note: This action is irreversible!')}</p>
					</ModalDialog> */}
				</div>
			</div>
		)
	}
})

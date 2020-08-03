import * as React from 'react'
import * as _ from 'underscore'
import { Translated } from '../lib/ReactMeteorData/ReactMeteorData'
import { RundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { Rundown } from '../../lib/collections/Rundowns'
import { withTranslation } from 'react-i18next'
import { EditAttribute } from '../lib/EditAttribute'
import { EvaluationBase } from '../../lib/collections/Evaluations'
import { doUserAction, UserAction } from '../lib/userAction'
import { MeteorCall } from '../../lib/api/methods'
import { SnapshotId } from '../../lib/collections/Snapshots'

interface IProps {
	playlist: RundownPlaylist
}
interface IState {
	q0: string
	q1: string
	q2: string
}
// export default withTranslation()(class Dashboard extends React.Component<Translated<IProps>, IState> {
export const AfterBroadcastForm = withTranslation()(
	class AfterBroadcastForm extends React.Component<Translated<IProps>, IState> {
		constructor(props: Translated<IProps>) {
			super(props)
			this.state = {
				q0: 'nothing',
				q1: '',
				q2: '',
			}
		}
		saveForm = (e: React.MouseEvent<HTMLElement>) => {
			const { t } = this.props
			let answers = this.state

			const saveEvaluation = (snapshotId?: SnapshotId) => {
				let evaluation: EvaluationBase = {
					studioId: this.props.playlist.studioId,
					playlistId: this.props.playlist._id,
					answers: answers,
				}
				if (snapshotId && evaluation.snapshots) evaluation.snapshots.push(snapshotId)

				doUserAction(t, e, UserAction.SAVE_EVALUATION, (e) => MeteorCall.userAction.saveEvaluation(e, evaluation))

				doUserAction(t, e, UserAction.DEACTIVATE_RUNDOWN_PLAYLIST, (e) =>
					MeteorCall.userAction.deactivate(e, this.props.playlist._id)
				)

				this.setState({
					q0: '',
					q1: '',
					q2: '',
				})
			}

			if (answers.q0 !== 'nothing' || answers.q1.trim() !== '') {
				doUserAction(
					t,
					e,
					UserAction.CREATE_SNAPSHOT_FOR_DEBUG,
					(e) => MeteorCall.userAction.storeRundownSnapshot(e, this.props.playlist._id, 'Evaluation form'),
					(err, snapshotId) => {
						if (!err && snapshotId) {
							saveEvaluation(snapshotId)
						} else {
							saveEvaluation()
						}
					}
				)
			} else {
				saveEvaluation()
			}
		}
		onUpdateValue = (edit: any, newValue: any) => {
			let attr = edit.props.attribute

			if (attr) {
				let m = {}
				m[attr] = newValue
				this.setState(m)
			}
		}
		render() {
			const { t } = this.props

			let obj = this.state
			// console.log('obj', obj)
			return (
				<div className="afterbroadcastform-container">
					<div className="afterbroadcastform">
						<h2>{t('Evaluation')}</h2>

						<p>
							<em>{t('Please take a minute to fill in this form.')}</em>
						</p>

						<div className="form">
							<div className="question">
								<p>{t('Did you have any problems with the broadcast?')}</p>
								<div className="input q0">
									<EditAttribute
										obj={obj}
										updateFunction={this.onUpdateValue}
										attribute="q0"
										type="dropdown"
										options={getQuestionOptions(t)}
									/>
								</div>
							</div>
							<div className="question q1">
								<p>
									{t(
										'Please explain the problems you experienced (what happened and when, what should have happened, what could have triggered the problems, etcetera...)'
									)}
								</p>
								<div className="input">
									<EditAttribute obj={obj} updateFunction={this.onUpdateValue} attribute="q1" type="multiline" />
								</div>
							</div>
							<div className="question q2">
								<p>{t('Your name')}</p>
								<div className="input">
									<EditAttribute obj={obj} updateFunction={this.onUpdateValue} attribute="q2" type="text" />
								</div>
							</div>

							<button className="btn btn-primary" onClick={this.saveForm}>
								{t('Save message and Deactivate Rundown')}
							</button>
						</div>
					</div>
				</div>
			)
		}
	}
)
export function getQuestionOptions(t) {
	return [
		{ value: 'nothing', name: t('No problems') },
		{ value: 'minor', name: t("Something went wrong, but it didn't affect the output") },
		{ value: 'major', name: t('Something went wrong, and it affected the output') },
	]
}

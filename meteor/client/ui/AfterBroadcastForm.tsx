import React, { useMemo, useState } from 'react'
import { Meteor } from 'meteor/meteor'
import { RundownPlaylist } from '../../lib/collections/RundownPlaylists'
import { TFunction, useTranslation } from 'react-i18next'
import { EvaluationBase } from '../../lib/collections/Evaluations'
import { doUserAction, UserAction } from '../../lib/clientUserAction'
import { MeteorCall } from '../../lib/api/methods'
import { SnapshotId } from '@sofie-automation/corelib/dist/dataModel/Ids'
import { ClientAPI } from '../../lib/api/client'
import { hashSingleUseToken } from '../../lib/api/userActions'
import { DropdownInputControl, DropdownInputOption, getDropdownInputOptions } from '../lib/Components/DropdownInput'
import { MultiLineTextInputControl } from '../lib/Components/MultiLineTextInput'
import { TextInputControl } from '../lib/Components/TextInput'
import { Spinner } from '../lib/Spinner'
import { NotificationCenter, Notification, NoticeLevel } from '../../lib/notifications/notifications'

type ProblemType = 'nothing' | 'minor' | 'major'

// const DEFAULT_STATE = {
// 	q0: 'nothing',
// 	q1: '',
// 	q2: '',
// }

const DEFAULT_STATE = {
	problems: 'nothing' as ProblemType,
	description: [],
	userName: '' as const,
} as const

export function AfterBroadcastForm({ playlist }: { playlist: RundownPlaylist }): JSX.Element {
	const { t } = useTranslation()
	const shouldDeactivateRundown = !playlist.loop
	const [problems, setProblems] = useState<ProblemType>(DEFAULT_STATE.problems)
	const [description, setDescription] = useState<string[]>(DEFAULT_STATE.description.slice())
	const [userName, setUserName] = useState<string>(DEFAULT_STATE.userName)
	const [busy, setBusy] = useState(false)

	function resetForm() {
		setProblems(DEFAULT_STATE.problems)
		setDescription(DEFAULT_STATE.description.slice())
		setUserName(DEFAULT_STATE.userName)
		setBusy(false)
	}

	function saveForm(e: React.MouseEvent<HTMLElement>) {
		setBusy(true)

		const answers = {
			q0: problems,
			q1: description.join('\n'),
			q2: userName,
		}

		e.persist()

		const saveEvaluation = (snapshotId?: SnapshotId) => {
			const evaluation: EvaluationBase = {
				studioId: playlist.studioId,
				playlistId: playlist._id,
				answers: answers,
				snapshots: [],
			}
			if (snapshotId && evaluation.snapshots) evaluation.snapshots.push(snapshotId)

			doUserAction(t, e, UserAction.SAVE_EVALUATION, (e, ts) => MeteorCall.userAction.saveEvaluation(e, ts, evaluation))

			if (shouldDeactivateRundown) {
				doUserAction(t, e, UserAction.DEACTIVATE_RUNDOWN_PLAYLIST, (e, ts) =>
					MeteorCall.userAction.deactivate(e, ts, playlist._id)
				)
			}

			resetForm()
		}

		if (answers.q0 !== 'nothing' || answers.q1.trim() !== '') {
			doUserAction(
				t,
				e,
				UserAction.CREATE_SNAPSHOT_FOR_DEBUG,
				async (e, ts) =>
					MeteorCall.system.generateSingleUseToken().then((tokenResult) => {
						if (ClientAPI.isClientResponseError(tokenResult) || !tokenResult.result) throw tokenResult
						return MeteorCall.userAction.storeRundownSnapshot(
							e,
							ts,
							hashSingleUseToken(tokenResult.result),
							playlist._id,
							'Evaluation form',
							false
						)
					}),
				(err, snapshotId) => {
					if (!err && snapshotId) {
						saveEvaluation(snapshotId)
						return false
					}
					saveEvaluation()
					if (err instanceof Meteor.Error && err.error === 503) {
						NotificationCenter.push(
							new Notification(
								undefined,
								NoticeLevel.CRITICAL,
								t(
									'Could not create a snapshot for the evaluation, because the previous one was created just moments ago. If you want another snapshot, try again in a couple of seconds.'
								),
								'userAction'
							)
						)
						return false
					}
				}
			)
		} else {
			saveEvaluation()
		}
	}

	const problemOptions = useMemo(() => getDropdownInputOptions<ProblemType>(getQuestionOptions(t)), [])

	return (
		<div className="afterbroadcastform-container" role="complementary" aria-labelledby="evaluation-header">
			<div className="afterbroadcastform">
				<h2 id="evaluation-header">{t('Evaluation')}</h2>

				<p>
					<em>{t('Please take a minute to fill in this form.')}</em>
				</p>
				<p>
					<b>{t('Be aware that while filling out the form keyboard and streamdeck commands will not be executed!')}</b>
				</p>

				<div className="form">
					<div className="question">
						<p>{t('Did you have any problems with the broadcast?')}</p>
						<div className="input q0">
							<DropdownInputControl
								value={problems}
								options={problemOptions}
								handleUpdate={setProblems}
								disabled={busy}
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
							<MultiLineTextInputControl value={description} handleUpdate={setDescription} disabled={busy} />
						</div>
					</div>
					<div className="question q2">
						<p>{t('Your name')}</p>
						<div className="input">
							<TextInputControl value={userName} handleUpdate={setUserName} disabled={busy} />
						</div>
					</div>

					<div>
						<button className="btn btn-primary" onClick={saveForm} disabled={busy}>
							{!shouldDeactivateRundown ? t('Save message') : t('Save message and Deactivate Rundown')}
						</button>
						{busy ? <Spinner className="afterbroadcastform-spinner" size="small" /> : null}
					</div>
				</div>
			</div>
		</div>
	)
}

export function getQuestionOptions(t: TFunction): Omit<DropdownInputOption<string>, 'i'>[] {
	return [
		{ value: 'nothing', name: t('No problems') },
		{ value: 'minor', name: t("Something went wrong, but it didn't affect the output") },
		{ value: 'major', name: t('Something went wrong, and it affected the output') },
	]
}

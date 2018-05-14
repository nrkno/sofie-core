import * as ClassNames from 'classnames'
import * as React from 'react'
import { InjectedTranslateProps, translate } from 'react-i18next'
import * as _ from 'underscore'
import { RundownAPI } from '../../../lib/api/rundown'
import { RuntimeFunction, RuntimeFunctions } from '../../../lib/collections/RuntimeFunctions'
import { EditAttribute } from '../../lib/EditAttribute'
import { ModalDialog } from '../../lib/ModalDialog'
import { withTracker } from '../../lib/ReactMeteorData/react-meteor-data'
import { Spinner } from '../../lib/Spinner'
import { literal } from '../../../lib/lib'
import { Random } from 'meteor/random'
import * as faTrash from '@fortawesome/fontawesome-free-solid/faTrash'
import * as faPencilAlt from '@fortawesome/fontawesome-free-solid/faPencilAlt'
import * as faCheck from '@fortawesome/fontawesome-free-solid/faCheck'
import * as faPlus from '@fortawesome/fontawesome-free-solid/faPlus'
import * as FontAwesomeIcon from '@fortawesome/react-fontawesome'
// import * as monaco from 'monaco-editor'
// import MonacoEditor from 'react-monaco-editor'

interface IPropsHeader {
	lineTemplate: RuntimeFunction
}

interface IStateHeader {
	code: string
}

class LineTemplates extends React.Component<IPropsHeader & InjectedTranslateProps, IStateHeader> {
	renderEditForm () {
		const { t } = this.props

		return (
				<div className='runtime-function-edit mod mhl mvs'>
					<EditAttribute
						modifiedClassName='bghl'
						attribute={'_code'}
						obj={this.props.lineTemplate}
						type='multiline'
						collection={RuntimeFunctions}
						className='runtime-function-edit__editor input text-input input-l'></EditAttribute>
				</div>
		)
	}

	render () {
		const { t } = this.props

		if (this.props.lineTemplate) {
			return this.renderEditForm()
		} else {
			return <Spinner />
		}
	}
}

export default translate()(withTracker((props, state) => {
	return {
		lineTemplate: RuntimeFunctions.findOne(props.match.params.ltId)
	}
})(LineTemplates))

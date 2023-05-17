import * as React from 'react'
import { Translated } from '../../lib/ReactMeteorData/react-meteor-data'
import * as reacti18next from 'react-i18next'

interface IDebugStateTableProps {
	debugState: object
}
interface IDebugStateTableState {}

export const DebugStateTable = reacti18next.withTranslation()(
	class DebugStateTable extends React.Component<Translated<IDebugStateTableProps>, IDebugStateTableState> {
		constructor(props: Translated<IDebugStateTableProps>) {
			super(props)
		}

		private getDebugStateTableBody(debugState: object) {
			/**
			 * Flattens object such that deeply-nested keys are moved to the top-level and are prefixed by
			 *   their parent keys.
			 *
			 * # Example
			 *
			 * { "key1": { "key2": [ { "key3": "example" } ] } }
			 *
			 * becomes
			 *
			 * { "key1.key2.0.key3": "example" }
			 * @param acc Accumulator object, should be passed an empty object to begin
			 * @param obj Object to recurse
			 * @param currentKey Current key within the object being recursed (initially blank)
			 * @returns "Flattened" object
			 */
			function toDotNotation(acc: object, obj: object, currentKey?: string): object {
				for (const key in obj) {
					const value = obj[key]
					const newKey = currentKey ? currentKey + '.' + key : key // joined key with dot
					if (value && typeof value === 'object' && Object.keys(value).length) {
						acc = toDotNotation(acc, value, newKey) // it's a nested object, so do it again
					} else {
						acc[newKey] = value // it's not an object, so set the property
					}
				}

				return acc
			}

			const objectInDotNotation = toDotNotation({}, debugState)
			return Object.entries<any>(objectInDotNotation).map(([key, value]) => {
				return (
					<tr key={key}>
						<td>{key}</td>
						<td>{JSON.stringify(value)}</td>
					</tr>
				)
			})
		}

		render(): JSX.Element {
			const { t } = this.props

			return (
				<div className="device-item__debugState">
					<label>{t('Debug State')}</label>
					<table className="table">
						<tbody>{this.getDebugStateTableBody(this.props.debugState)}</tbody>
					</table>
				</div>
			)
		}
	}
)

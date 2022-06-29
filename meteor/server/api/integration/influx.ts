import { Meteor } from 'meteor/meteor'
import { PackageInfo } from '../../coreSystem'
import { initInfluxdb } from '@sofie-automation/corelib/dist/influxdb'
export { startTrace, endTrace, sendTrace, TimeTrace, FinishedTrace } from '@sofie-automation/corelib/dist/influxdb'

const config = {
	host: process.env.INFLUX_HOST || Meteor.settings.influxHost,
	database: process.env.INFLUX_DATABASE || Meteor.settings.influxDatabase || 'sofie',
	port: process.env.INFLUX_PORT || Meteor.settings.influxPort || 8086,
	user: process.env.INFLUX_USER || Meteor.settings.influxUser || 'sofie',
	password: process.env.INFLUX_PASSWORD || Meteor.settings.influxPassword,
}

initInfluxdb(config, getVersions())

function getVersions(): Record<string, string> {
	const versions: { [packageName: string]: string } = {}

	versions['coreVersion'] = PackageInfo.versionExtended || PackageInfo.version // package version

	return versions
}

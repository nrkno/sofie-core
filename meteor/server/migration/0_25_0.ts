import { addMigrationSteps } from './databaseMigration'
import * as _ from 'underscore'
import { Blueprints } from '../../lib/collections/Blueprints'
import { BlueprintManifestType } from 'tv-automation-sofie-blueprints-integration'
import { Mongo } from 'meteor/mongo'
import { renamePropertiesInCollection } from './lib'
import { AsRunLog } from '../../lib/collections/AsRunLog'

// 0.25.0 // This is a big refactoring, with a LOT of renamings
addMigrationSteps( '0.25.0', [

	renamePropertiesInCollection('asRunLogEvents',
		AsRunLog,
		'AsRunLog',
		{
			rundownId:		'rundownId',
			// segmentId:		'segmentId',
			segmentLineId:		'partId',
			pieceId:	'pieceId'
		}
	)


	// add steps here:
	// {
	// 	id: 'my fancy step',
	// 	canBeRunAutomatically: true,
	// 	validate: () => {
	// 		return false
	// 	},
	// 	migrate: () => {
	// 		//
	// 	}
	// },
])

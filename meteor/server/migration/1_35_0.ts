import { addMigrationSteps } from './databaseMigration'
import * as semver from 'semver'
import { dropDeprecatedDatabase, getDeprecatedDatabase } from './deprecatedDatabases/1_35_0'
import { PackageContainerPackageStatuses } from '../collections'
import { getCoreSystem } from '../coreSystem/collection'

// Release 35 (2021-07-13)
export const addSteps = addMigrationSteps('1.35.0', [
	{
		id: 'Fix badly named collection PackageContainerStatuses',
		canBeRunAutomatically: true,
		validate: () => {
			// Note: in versions <1.35, the collection PackageContainerPackageStatuses had mistankenly been created at the mongo-collection
			// "packageContainerStatuses" instead of "packageContainerPackageStatuses"

			const databaseSystem = getCoreSystem()

			// Only run this if version is under 1.33.0, in order to not create the deprecated databases
			if (databaseSystem && semver.satisfies(databaseSystem.version, '<1.33.0')) {
				const wrongCollection = getDeprecatedDatabase()

				if (wrongCollection) {
					// Find documents that is not (the possibly upcoming) packageContainerStatuses, but is instead of packageContainerPackageStatuses:
					const count = wrongCollection
						.find({
							studioId: { $exists: true },
							containerId: { $exists: true },
							packageId: { $exists: true },
							modified: { $exists: true },
							status: { $exists: true },
							'status.contentVersionHash': { $exists: true },
							'status.isPlaceholder': { $exists: true },
							'status.status': { $exists: true },
						})
						.count()
					if (count)
						return `Collection PackageContainerStatuses contains "${count}" documents that need to be moved`
				}
			}
			return false
		},
		migrate: () => {
			const wrongCollection = getDeprecatedDatabase()

			if (wrongCollection) {
				wrongCollection
					.find({
						studioId: { $exists: true },
						containerId: { $exists: true },
						packageId: { $exists: true },
						modified: { $exists: true },
						status: { $exists: true },
						'status.contentVersionHash': { $exists: true },
						'status.isPlaceholder': { $exists: true },
						'status.status': { $exists: true },
					})
					.forEach((doc: any) => {
						PackageContainerPackageStatuses.insert(doc)
						wrongCollection.remove(doc._id)
					})

				dropDeprecatedDatabase()
			}
		},
	},
])

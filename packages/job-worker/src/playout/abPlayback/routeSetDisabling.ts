import type { ABPlayerDefinition, AbPlayerId } from '@sofie-automation/blueprints-integration'
import type { StudioRouteSet } from '@sofie-automation/corelib/dist/dataModel/Studio'
import { logger } from '../../logging'

/**
 * Map<poolName, Map<playerId, disablePlayer>>
 */
type MembersOfRouteSets = Map<string, Map<AbPlayerId, boolean>>

export function findPlayersInRouteSets(routeSets: Record<string, StudioRouteSet>): MembersOfRouteSets {
	const routeSetEnabledPlayers: MembersOfRouteSets = new Map()
	for (const [_key, routeSet] of Object.entries<StudioRouteSet>(routeSets)) {
		for (const abPlayer of routeSet.abPlayers) {
			let poolEntry = routeSetEnabledPlayers.get(abPlayer.poolName)
			if (!poolEntry) {
				poolEntry = new Map()
				routeSetEnabledPlayers.set(abPlayer.poolName, poolEntry)
			}

			// Make sure player is marked as enabled
			const currentState = poolEntry.get(abPlayer.playerId)
			poolEntry.set(abPlayer.playerId, currentState || routeSet.active)
		}
	}
	return routeSetEnabledPlayers
}

export function abPoolFilterDisabled(
	poolName: string,
	players: ABPlayerDefinition[],
	membersOfRouteSets: MembersOfRouteSets
): ABPlayerDefinition[] {
	const poolRouteSetEnabledPlayers = membersOfRouteSets.get(poolName)
	if (!poolRouteSetEnabledPlayers || poolRouteSetEnabledPlayers.size == 0) return players

	// Filter out any disabled players:
	return players.filter((player) => {
		const playerState = poolRouteSetEnabledPlayers.get(player.playerId)
		if (playerState === false) {
			logger.silly(`AB Pool ${poolName} playerId : ${player.playerId} are disabled`)
			return false
		}

		return true
	})
}

/** How many parts lookahead will search through when no other value is specified  */
export const LOOKAHEAD_DEFAULT_SEARCH_DISTANCE = 10

/** TODO - this should be some kind of config */
export const PRESERVE_UNSYNCED_PLAYING_SEGMENT_CONTENTS = false

/** After this time, MOS-messages are considered to have timed out */
export const DEFAULT_MOS_TIMEOUT_TIME = 10 * 1000

/** How often to ping NRCS (to determine connection status) */
export const DEFAULT_MOS_HEARTBEAT_INTERVAL = 30 * 1000

/** After this time, messages to the NRCS are considered to have timed out */
export const DEFAULT_NRCS_TIMEOUT_TIME = 10 * 1000

/** After this time, actions executed by the TSR are considered to have timed out */
export const DEFAULT_TSR_ACTION_TIMEOUT_TIME = 5 * 1000

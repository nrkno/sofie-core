import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { PeripheralDeviceCommands } from '../../lib/collections/PeripheralDeviceCommands'
import { Tasks } from '../../lib/collections/Tasks'
import { RunningOrders } from '../../lib/collections/RunningOrders'
import { SegmentLineItems } from '../../lib/collections/SegmentLineItems'
import { SegmentLines } from '../../lib/collections/SegmentLines'
import { Segments } from '../../lib/collections/Segments'
import { ShowStyles } from '../../lib/collections/ShowStyles'
import { StudioInstallations } from '../../lib/collections/StudioInstallations'
import { Timeline } from '../../lib/collections/Timeline'
import { RuntimeFunctions } from '../../lib/collections/RuntimeFunctions'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { getCurrentTime } from '../../lib/lib'
import { MediaObjects } from '../../lib/collections/MediaObjects'
import { SegmentLineAdLibItems } from '../../lib/collections/SegmentLineAdLibItems'
import { RunningOrderBaselineAdLibItems } from '../../lib/collections/RunningOrderBaselineAdLibItems'
import { RunningOrderDataCache } from '../../lib/collections/RunningOrderDataCache'
import { RunningOrderBaselineItems } from '../../lib/collections/RunningOrderBaselineItems'
import { RuntimeFunctionDebugData } from '../../lib/collections/RuntimeFunctionDebugData'
import { Session } from 'meteor/session'

// Note: These things are convenience functions to be used during development

window['Tasks'] = Tasks
window['PeripheralDevices'] = PeripheralDevices
window['PeripheralDeviceCommands'] = PeripheralDeviceCommands
window['executeFunction'] = PeripheralDeviceAPI.executeFunction
window['RunningOrders'] = RunningOrders
window['SegmentLineItems'] = SegmentLineItems
window['SegmentLines'] = SegmentLines
window['Segments'] = Segments
window['ShowStyles'] = ShowStyles
window['StudioInstallations'] = StudioInstallations
window['RuntimeFunctions'] = RuntimeFunctions
window['Timeline'] = Timeline
window['MediaObjects'] = MediaObjects
window['SegmentLineAdLibItems'] = SegmentLineAdLibItems
window['RunningOrderBaselineAdLibItems'] = RunningOrderBaselineAdLibItems
window['RunningOrderDataCache'] = RunningOrderDataCache
window['RunningOrderBaselineItems'] = RunningOrderBaselineItems
window['RuntimeFunctionDebugData'] = RuntimeFunctionDebugData

window['getCurrentTime'] = getCurrentTime
window['Session'] = Session

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
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice';

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
window['Timeline'] = Timeline

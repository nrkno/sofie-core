import { PeripheralDevices } 	from "../../lib/collections/PeripheralDevices";
import { Tasks } 				from "../../lib/collections/Tasks";
import { RunningOrders } from "../../lib/collections/RunningOrders";
import { SegmentLineItems } from "../../lib/collections/SegmentLineItems";
import { SegmentLines } from "../../lib/collections/SegmentLines";
import { Segments } from "../../lib/collections/Segments";
import { ShowStyles } from "../../lib/collections/ShowStyles";
import { StudioInstallations } from "../../lib/collections/StudioInstallations";


// Note: These things are convenience functions to be used during development


window['Tasks'] = Tasks;
window['PeripheralDevices'] = PeripheralDevices;
window['RunningOrders'] = RunningOrders;
window['SegmentLineItmes'] = SegmentLineItems;
window['SegmentLines'] = SegmentLines;
window['Segments'] = Segments;
window['ShowsStyles'] = ShowStyles;
window['StudioInstallations'] = StudioInstallations;

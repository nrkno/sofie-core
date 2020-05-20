import { StudioId } from '../collections/Studios'
import { RecordedFileId } from '../collections/RecordedFiles'

export interface NewTestToolsAPI {
	recordStop (studioId: StudioId): Promise<void>
	recordStart (studioId: StudioId, name: string): Promise<void>
	recordDelete (fileId: RecordedFileId): Promise<void>
}

export enum TestToolsAPIMethods {
	'recordStop' = 'testTools.recordStop',
	'recordStart' = 'testTools.recordStart',
	'recordDelete' = 'testTools.recordDelete'
}

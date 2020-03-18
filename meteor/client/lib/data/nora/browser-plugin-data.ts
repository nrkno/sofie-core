import { PieceGeneric } from '../../../../lib/collections/Pieces'
import { NoraContent } from 'tv-automation-sofie-blueprints-integration'
import { generateMosPluginItemXml } from '../../parsers/mos/mosXml2Js'

export function createMosObjectXmlStringNoraBluePrintPiece (piece: PieceGeneric): string {
	const noraContent = piece.content as NoraContent | undefined
	if (!noraContent || !noraContent.externalPayload) {
		throw new Error('Not a Nora blueprint piece')
	}

	return generateMosPluginItemXml(noraContent.externalPayload)
}
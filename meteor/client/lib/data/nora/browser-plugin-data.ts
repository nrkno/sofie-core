import { NoraPayload } from 'tv-automation-sofie-blueprints-integration'
import { InternalIBlueprintPieceGeneric } from '../../../../lib/collections/Pieces'
import { objectToXML } from '../mos/plugin-support'

export { createMosObjectXmlStringNoraBluePrintPiece }

function createMosObjectXmlStringNoraBluePrintPiece(piece: InternalIBlueprintPieceGeneric): string {
	if (!piece.content || !piece.content.payload) {
		throw new Error('Not a Nora blueprint piece')
	}

	const noraPayload = piece.content.payload as NoraPayload

	const doc = objectToXML({
		ncsItem: {
			item: {
				itemSlug: null,
				objID: piece.externalId,
				mosExternalMetadata: [{
					mosSchema: 'http://nora.core.mesosint.nrk.no/mos/content',
					mosPayload: {
						metadata: {
							selection: {
								design: {
									id: noraPayload.manifest
								},
								type: {
									id: noraPayload.template.layer
								},
								mal: {
									id: noraPayload.template.name
								}
							},
							type: noraPayload.template.layer,
							userContext: {}
						},
						template: noraPayload.template,
						content: noraPayload.content
					}
				}, {
					mosSchema: 'http://nora.core.mesosint.nrk.no/mos/timing',
					mosPayload: {
						timeIn: 0,
						duration: piece.content.sourceDuration
					}
				}]
			},
		}
	}, 'mos'
	)

	return new XMLSerializer().serializeToString(doc)
}
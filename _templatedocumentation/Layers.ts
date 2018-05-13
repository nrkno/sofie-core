// !! HUMAN READABLE DOCUMENTATION ONLY, NOT INTENDED FOR IMPLEMENTATION
import ATEM from './ATEM'
import CasparCG from './CasparCG'
import Lawo from './Lawo'

const SourceLayers = [
    {
        _id: 'studio0-lower-third0',
        _rank: 10,
        name: 'Super',
        type: RundownAPI.SourceLayerType.LOWER_THIRD,
        unlimited: true,
        onPGMClean: false
    },
    {
        _id: 'studio0-split0',
        _rank: 15,
        name: 'Split',
        type: RundownAPI.SourceLayerType.SPLITS,
        onPGMClean: true,
    },
    {
        _id: 'studio0-graphics0',
        _rank: 20,
        name: 'GFX',
        type: RundownAPI.SourceLayerType.GRAPHICS,
        onPGMClean: false
    },
    {
        _id: 'studio0-live-speak0',
        _rank: 50,
        name: 'STK',
        type: RundownAPI.SourceLayerType.LIVE_SPEAK,
        onPGMClean: false
    },
    {
        _id: 'studio0-remote0',
        _rank: 60,
        name: 'RM1',
        type: RundownAPI.SourceLayerType.REMOTE,
        onPGMClean: true,
        isRemoteInput: true
    },
    {
        _id: 'studio0-vt0',
        _rank: 80,
        name: 'VB',
        type: RundownAPI.SourceLayerType.VT,
        onPGMClean: true,
    },
    {
        _id: 'studio0-mic0',
        _rank: 90,
        name: 'Mic',
        type: RundownAPI.SourceLayerType.MIC,
        onPGMClean: true,
    },
    {
        _id: 'studio0-camera0',
        _rank: 100,
        name: 'Kam',
        type: RundownAPI.SourceLayerType.CAMERA,
        onPGMClean: true,
    },
]

const OutputLayers = [
	{
		_id: 'pgm0',
		name: 'PGM',
		isPGM: true,
	},
	{
		_id: 'monitor0',
		name: 'Skjerm',
		isPGM: false,
	}
]

const Llayers = [

]

export {SourceLayers, OutputLayers, Llayers}
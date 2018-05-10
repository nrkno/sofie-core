// !! HUMAN READABLE DOCUMENTATION ONLY, NOT INTENDED FOR IMPLEMENTATION
const CasparCG = {
    channels: {
        1: {
            systemName: "VB1",
            signalID: "CSERV 1",
            decklink: {
                device: 9,
                type: "FILL",
                embedded: true,
                signalPath: "DDA, MV, RIn, BM IN14"
            },
            description: "Layers(s) of clip. Audio on dedicated fader."
        },
        2: {
            systemName: "PVW",
            signalID: "CSERV PVW",
            decklink: {
                device: 13,
                type: "FILL",
                embedded: true,
                signalPath: "DDA, MV, RIn, BM IN15" // @todo: remove from BM or simply disable XPT to prevent getting on air?
            },
            description: "Completely free usage to help Producer view/listen/check content. Audio to PFL."  // @todo: prevent audio from PGM mix?
        },
        3: {
            systemName: "VB2",
            signalID: "CSERV 2-1 / CSERV 2-2",
            decklink: {
                device: 10,
                type: "KEY/FILL",
                embedded: false,
                signalPath: "DDA, MV, RIn, BM IN16/17"
            },
            description: "Studio screen + other fullscreen sources/backgrounds."
        },
        4: {
            systemName: "CG1",
            signalID: "CG1-1 / CG1-2",
            decklink: {
                device: 11,
                type: "KEY/FILL",
                embedded: false,
                signalPath: "DDA, MV, RIn, BM IN10/11"
            },
            description: "DSK1. Graphic overlays for PGM, stripped from CLEAN." // @todo: TBD swap DSK1/2 dependant on if we need one (current) or two levels of CLEAN
        },
        5: {
            systemName: "CG2",
            signalID: "CG2-1 / CG2-2",
            decklink: {
                device: 12,
                type: "KEY/FILL",
                embedded: true,
                signalPath: "DDA, MV, RIn, BM IN12/13"
            },
            description: "DSK2 Vignett (opening title) with alpha, wipes/bumpers, effect sounds"   // @todo: TBD swap DSK1/2 dependant on if we need one (current) or two levels of CLEAN
        }
    },
    inputs: {
        1: {
            systemName: "Input 1",
            signalID: "RC1",
            decklink: {
                device: 1,
                signalPath: "R ut"
            },
            description: "n/a"
        },
        2: {
            systemName: "Input 2",
            signalID: "RC2",
            decklink: {
                device: 2,
                signalPath: "R ut"
            },
            description: "n/a"
        },
        3: {
            systemName: "Input 3",
            signalID: "RC3",
            decklink: {
                device: 3,
                signalPath: "R ut"
            },
            description: "n/a"
        },
        4: {
            systemName: "Input 4",
            signalID: "RC4",
            decklink: {
                device: 4,
                signalPath: "R ut"
            },
            description: "n/a"
        }
    }
}

export default CasparCG
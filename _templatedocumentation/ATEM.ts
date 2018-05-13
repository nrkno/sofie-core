// !! HUMAN READABLE DOCUMENTATION ONLY, NOT INTENDED FOR IMPLEMENTATION
const ATEM = {
    inputs: {
        10: {
            systemName: "CG1 Fill",
            id: "CG1-1",
            input: {
                xpt: false
            },
            description: "DSK1, graphics overlay for PGM."

        },
        11: {
            systemName: "CG1 Key",
            id: "CG1-2",
            input: {
                xpt: false
            },
            description: "DSK1, graphics overlay for PGM."

        },
        12: {
            systemName: "CG2 Fill",
            id: "CG2-1",
            input: {
                xpt: true
            },
            description: "DSK2, vignett/wipe/bumpers."

        },
        13: {
            systemName: "CG2 Key",
            id: "CG2-2",
            input: {
                xpt: true
            },
            description: "DSK2, vignett/wipe/bumpers."

        },
        14: {
            systemName: "VB1",
            id: "CSERV 1",
            input: {
                xpt: true
            },
            description: "Clips and other FULL content from VB1."

        },
        15: {
            systemName: "PVW",
            id: "CSERV PVW",
            input: {
                xpt: false
            },
            description: "Completely free usage to help Producer view/check content."

        },
        16: {
            systemName: "VB2 Fill",
            id: "CSERV 2-1",
            input: {
                xpt: true
            },
            description: "Studio screen + other fullscreen sources/backgrounds."

        },
        17: {
            systemName: "VB2 Key",
            id: "CSERV 2-2",
            input: {
                xpt: false
            },
            description: "Studio screen + other fullscreen sources/backgrounds."

        },
        "": {
            systemName: "SuperSource",
            id: "",
            input: {
                xpt: true
            },
            description: ""

        }
    },
    outputs: {
        me1: {
            systemName: "PGM",
            id: "PGM 1",
            output: {

            },
            description: ""
        },
        me2: {
            systemName: "StudioMon",
            id: "PUB Bakgrunn",
            output: {

            },
            description: ""
        },
        pvw: {
            systemName: "NEXT",
            id: "M/E1 PVW",
            output: {

            },
            description: ""
        },
        aux1: {
            systemName: "CLN",
            id: "AUX 1",
            output: {

            },
            description: ""
        }
    },
    keyers: {
        dsk1: {
            systemName: "Graphics",
            id: "CG",
            keyer: {

            },
            description: "" 

        },
        dsk2: {
            systemName: "Effects",
            id: "FX",
            keyer: {

            },
            description: "" 

        },
        superSource: {
            systemName: "split",
            id: "2 like",
            superSource: {

            },
            description: "" 

        }
    },
    mediaPlayers: {
        mp1: {
            systemName: "wipe",
            id: "mp1",
            mediaPlayer: {

            },
            description: "" 

        }
    },
    macros: {
        
    }
}

const sources = {
  "Blk": 0,
  "Bars": 1000,
  "Col1": 2001,
  "Col2": 2002,
  "MP1": 3010,
  "MP1K": 3011,
  "MP2": 3020,
  "MP2K": 3021,
  "SSrc": 6000,
  "Cfd1": 7001,
  "Cfd2": 7002,
  "Aux1": 8001,
  "Aux2": 8002,
  "Aux3": 8003,
  "Aux4": 8004,
  "Aux5": 8005,
  "Aux6": 8006,
  "Prg1": 10010,
  "Prv1": 10011,
  "Prg2": 10020,
  "Prv2": 10021
}

export default ATEM
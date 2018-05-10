// !! HUMAN READABLE DOCUMENTATION ONLY, NOT INTENDED FOR IMPLEMENTATION
const Lawo = {
    channels: {
        "": {
            systemName: "Automiks",
            id: "",
            source: {
                path: "",
                identifier: ""
            },
            description: "Sum of host and guests in studio."
        },
        "": {
            systemName: "VB1",
            id: "",
            source: {
                path: "",
                identifier: ""
            },
            description: "Clips and other FULL content from VB1."
        },
        "": {
            systemName: "CG2",
            id: "",
            source: {
                path: "",
                identifier: ""
            },
            description: "Effect sounds from CG2."
        },
        "": {
            systemName: "Preview",
            id: "",
            source: {
                path: "",
                identifier: ""
            },
            description: "PFL PVW."  // @todo: Not included in PGM mix
        }
    },
    functions: {
        RampMotorFader: {
            function: {
                path: "1.5.2",
                identifier: "RampMotorFader",
                arguments: {
                    0: {key: "Source Name", type: "UTF8"},
                    1: {key: "Gain[dB]", type: "REAL"},
                    2: {key: "Time[s]", type: "REAL"}
                }
            }
        }
    }
}
export default Lawo
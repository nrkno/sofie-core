export enum AtemSource {
	DSK1F = 10,
	DSK1K = 11,
	DSK2F = 12,
	DSK2K = 13,
	Server1 = 14,
	Server1Next = 15,
	Server2 = 16,
	Server3 = 17, // @todo confirm input for ssrc background
	Grafikk = 1000, // @todo

	Default = 2001, // holder defined in show style - @todo change
}

export const RMFirstInput = 4 // First ATEM input number
export const KamFirstInput = 1 // First ATEM input number

export const LawoFadeInDuration = 160 // 4 frames

export const AtemWipeSettings = {
	wipe: {
		rate: 9,
		pattern: 17,
		borderWidth: 0,
		symmetry: 5000,
		borderSoftness: 10000,
		reverseDirection: true,
		flipFlop: false
	}
}

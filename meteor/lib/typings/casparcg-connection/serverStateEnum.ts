// Note: This file only contains typings exported from the casparcg-state library
export declare namespace Enum {
	/**
	 *
	 */
	abstract class AbstractEnum {
		value: string
		/**
		 *
		 */
		constructor (value: string)
		/**
		 *
		 */
		toString (): string
	}
	/**
	 *
	 */
	class Command extends AbstractEnum {
		static readonly LOADBG: Command
		static readonly LOAD: Command
		static readonly PLAY: Command
		static readonly PAUSE: Command
		static readonly RESUME: Command
		static readonly STOP: Command
		static readonly CLEAR: Command
		static readonly CALL: Command
		static readonly SWAP: Command
		static readonly ADD: Command
		static readonly REMOVE: Command
		static readonly PRINT: Command
		static readonly LOG_LEVEL: Command
		static readonly LOG_CATEGORY: Command
		static readonly SET: Command
		static readonly LOCK: Command
		static readonly DATA_STORE: Command
		static readonly DATA_RETRIEVE: Command
		static readonly DATA_LIST: Command
		static readonly DATA_REMOVE: Command
		static readonly CG_ADD: Command
		static readonly CG_PLAY: Command
		static readonly CG_STOP: Command
		static readonly CG_NEXT: Command
		static readonly CG_REMOVE: Command
		static readonly CG_CLEAR: Command
		static readonly CG_UPDATE: Command
		static readonly CG_INVOKE: Command
		static readonly CG_INFO: Command
		static readonly MIXER_KEYER: Command
		static readonly MIXER_CHROMA: Command
		static readonly MIXER_BLEND: Command
		static readonly MIXER_OPACITY: Command
		static readonly MIXER_BRIGHTNESS: Command
		static readonly MIXER_SATURATION: Command
		static readonly MIXER_CONTRAST: Command
		static readonly MIXER_LEVELS: Command
		static readonly MIXER_FILL: Command
		static readonly MIXER_CLIP: Command
		static readonly MIXER_ANCHOR: Command
		static readonly MIXER_CROP: Command
		static readonly MIXER_ROTATION: Command
		static readonly MIXER_PERSPECTIVE: Command
		static readonly MIXER_MIPMAP: Command
		static readonly MIXER_VOLUME: Command
		static readonly MIXER_MASTERVOLUME: Command
		static readonly MIXER_STRAIGHT_ALPHA_OUTPUT: Command
		static readonly MIXER_GRID: Command
		static readonly MIXER_COMMIT: Command
		static readonly MIXER_CLEAR: Command
		static readonly CHANNEL_GRID: Command
		static readonly THUMBNAIL_LIST: Command
		static readonly THUMBNAIL_RETRIEVE: Command
		static readonly THUMBNAIL_GENERATE: Command
		static readonly THUMBNAIL_GENERATE_ALL: Command
		static readonly CINF: Command
		static readonly CLS: Command
		static readonly FLS: Command
		static readonly TLS: Command
		static readonly VERSION: Command
		static readonly INFO: Command
		static readonly INFO_TEMPLATE: Command
		static readonly INFO_CONFIG: Command
		static readonly INFO_PATHS: Command
		static readonly INFO_SYSTEM: Command
		static readonly INFO_SERVER: Command
		static readonly INFO_QUEUES: Command
		static readonly INFO_THREADS: Command
		static readonly INFO_DELAY: Command
		static readonly DIAG: Command
		static readonly GL_INFO: Command
		static readonly GL_GC: Command
		static readonly BYE: Command
		static readonly KILL: Command
		static readonly RESTART: Command
		static readonly HELP: Command
		static readonly HELP_PRODUCER: Command
		static readonly HELP_CONSUMER: Command
	}
	/**
	 *
	 */
	class Producer extends AbstractEnum {
		static readonly FFMPEG: Producer
		static readonly DECKLINK: Producer
		static readonly HTML: Producer
		static readonly PSD: Producer
		static readonly FLASH: Producer
		static readonly FLASH_CT: Producer
		static readonly FLASH_SWF: Producer
		static readonly IMAGE_SCROLL: Producer
		static readonly IMAGE: Producer
		static readonly REROUTE: Producer
		static readonly TEXT: Producer
		static readonly SCENE: Producer
		static readonly COLOR: Producer
	}
	/**
	 *
	 */
	class Consumer extends AbstractEnum {
		static readonly FFMPEG: Consumer
		static readonly STREAMING: Consumer
		static readonly ADUIO: Consumer
		static readonly BLUEFISH: Consumer
		static readonly DECKLINK: Consumer
		static readonly SCREEN: Consumer
		static readonly IVGA: Consumer
		static readonly IMAGE: Consumer
	}
	/**
	 *
	 *
	 */
	class Version extends AbstractEnum {
		static readonly SERVER: Version
		static readonly FLASH: Version
		static readonly TEMPLATEHOST: Version
		static readonly CEF: Version
	}
	/**
	 *
	 *
	 */
	class Lock extends AbstractEnum {
		static readonly ACQUIRE: Lock
		static readonly RELEASE: Lock
		static readonly CLEAR: Lock
	}
	/**
	 *
	 *
	 */
	class LogCategory extends AbstractEnum {
		static readonly CALLTRACE: LogCategory
		static readonly COMMUNICATION: LogCategory
	}
	/**
	 *
	 *
	 */
	class Chroma extends AbstractEnum {
		static readonly NONE: Chroma
		static readonly GREEN: Chroma
		static readonly BLUE: Chroma
	}
	/**
	 *
	 *
	 */
	class LogLevel extends AbstractEnum {
		static readonly TRACE: LogLevel
		static readonly DEBUG: LogLevel
		static readonly INFO: LogLevel
		static readonly WARNING: LogLevel
		static readonly ERROR: LogLevel
		static readonly FATAL: LogLevel
	}
	/**
	 *
	 *
	 */
	class Transition extends AbstractEnum {
		static readonly CUT: Transition
		static readonly MIX: Transition
		static readonly PUSH: Transition
		static readonly WIPE: Transition
		static readonly SLIDE: Transition
	}
	/**
	 *
	 *
	 */
	class Direction extends AbstractEnum {
		static readonly LEFT: Direction
		static readonly RIGHT: Direction
	}
	/**
	 *
	 */
	class BlendMode extends AbstractEnum {
		static readonly NORMAL: BlendMode
		static readonly LIGHTEN: BlendMode
		static readonly DARKEN: BlendMode
		static readonly MULTIPLY: BlendMode
		static readonly AVERAGE: BlendMode
		static readonly ADD: BlendMode
		static readonly SUBTRACT: BlendMode
		static readonly DIFFERENCE: BlendMode
		static readonly NEGATION: BlendMode
		static readonly EXCLUSION: BlendMode
		static readonly SCREEN: BlendMode
		static readonly OVERLAY: BlendMode
		static readonly SOFT_LIGHT: BlendMode
		static readonly HARD_LIGHT: BlendMode
		static readonly COLOR_DODGE: BlendMode
		static readonly COLOR_BURN: BlendMode
		static readonly LINEAR_DODGE: BlendMode
		static readonly LINEAR_BURN: BlendMode
		static readonly LINEAR_LIGHT: BlendMode
		static readonly VIVID_LIGHT: BlendMode
		static readonly PIN_LIGHT: BlendMode
		static readonly HARD_MIX: BlendMode
		static readonly REFLECT: BlendMode
		static readonly GLOW: BlendMode
		static readonly PHOENIX: BlendMode
		static readonly CONTRAST: BlendMode
		static readonly SATURATION: BlendMode
		static readonly COLOR: BlendMode
		static readonly LUMINOSITY: BlendMode
	}
	/**
	 *
	 */
	class Ease extends AbstractEnum {
		static readonly LINEAR: Ease
		static readonly EASELINEAR: Ease
		static readonly NONE: Ease
		static readonly EASENONE: Ease
		static readonly IN_QUAD: Ease
		static readonly EASEINQUAD: Ease
		static readonly OUT_QUAD: Ease
		static readonly EASEOUTQUAD: Ease
		static readonly IN_OUT_QUAD: Ease
		static readonly EASEINOUTQUAD: Ease
		static readonly OUT_IN_QUAD: Ease
		static readonly EASEOUTINQUAD: Ease
		static readonly IN_CUBIC: Ease
		static readonly EASEINCUBIC: Ease
		static readonly OUT_CUBIC: Ease
		static readonly EASEOUTCUBIC: Ease
		static readonly IN_OUT_CUBIC: Ease
		static readonly EASEINOUTCUBIC: Ease
		static readonly OUT_IN_CUBIC: Ease
		static readonly EASEOUTINCUBIC: Ease
		static readonly IN_QUART: Ease
		static readonly EASEINQUART: Ease
		static readonly OUT_QUART: Ease
		static readonly EASEOUTQUART: Ease
		static readonly IN_OUT_QUART: Ease
		static readonly EASEINOUTQUART: Ease
		static readonly OUT_IN_QUART: Ease
		static readonly EASEOUTINQUART: Ease
		static readonly IN_QUINT: Ease
		static readonly EASEINQUINT: Ease
		static readonly OUT_QUINT: Ease
		static readonly EASEOUTQUINT: Ease
		static readonly IN_OUT_QUINT: Ease
		static readonly EASEINOUTQUINT: Ease
		static readonly OUT_IN_QUINT: Ease
		static readonly EASEOUTINQUINT: Ease
		static readonly IN_SINE: Ease
		static readonly EASEINSINE: Ease
		static readonly OUT_SINE: Ease
		static readonly EASEOUTSINE: Ease
		static readonly IN_OUT_SINE: Ease
		static readonly EASEINOUTSINE: Ease
		static readonly OUT_IN_SINE: Ease
		static readonly EASEOUTINSINE: Ease
		static readonly IN_EXPO: Ease
		static readonly EASEINEXPO: Ease
		static readonly OUT_EXPO: Ease
		static readonly EASEOUTEXPO: Ease
		static readonly IN_OUT_EXPO: Ease
		static readonly EASEINOUTEXPO: Ease
		static readonly OUT_IN_EXPO: Ease
		static readonly EASEOUTINEXPO: Ease
		static readonly IN_CIRC: Ease
		static readonly EASEINCIRC: Ease
		static readonly OUT_CIRC: Ease
		static readonly EASEOUTCIRC: Ease
		static readonly IN_OUT_CIRC: Ease
		static readonly EASEINOUTCIRC: Ease
		static readonly OUT_IN_CIRC: Ease
		static readonly EASEOUTINCIRC: Ease
		static readonly IN_ELASTIC: Ease
		static readonly EASEINELASTIC: Ease
		static readonly OUT_ELASTIC: Ease
		static readonly EASEOUTELASTIC: Ease
		static readonly IN_OUT_ELASTIC: Ease
		static readonly EASEINOUTELASTIC: Ease
		static readonly OUT_IN_ELASTIC: Ease
		static readonly EASEOUTINELASTIC: Ease
		static readonly IN_BACK: Ease
		static readonly EASEINBACK: Ease
		static readonly OUT_BACK: Ease
		static readonly EASEOUTBACK: Ease
		static readonly IN_OUT_BACK: Ease
		static readonly EASEINOUTBACK: Ease
		static readonly OUT_IN_BACK: Ease
		static readonly EASEOUTINBACK: Ease
		static readonly OUT_BOUNCE: Ease
		static readonly EASEOUTBOUNCE: Ease
		static readonly IN_BOUNCE: Ease
		static readonly EASEINBOUNCE: Ease
		static readonly IN_OUT_BOUNCE: Ease
		static readonly EASEINOUTBOUNCE: Ease
		static readonly OUT_IN_BOUNCE: Ease
		static readonly EASEOUTINBOUNCE: Ease
	}
	/**
	 *
	 */
	class ChannelFormat extends AbstractEnum {
		static readonly INVALID: ChannelFormat
		static readonly PAL: ChannelFormat
		static readonly NTSC: ChannelFormat
		static readonly SD_576P2500: ChannelFormat
		static readonly HD_720P2398: ChannelFormat
		static readonly HD_720P2400: ChannelFormat
		static readonly HD_720P2500: ChannelFormat
		static readonly HD_720P5000: ChannelFormat
		static readonly HD_720P2997: ChannelFormat
		static readonly HD_720P5994: ChannelFormat
		static readonly HD_720P3000: ChannelFormat
		static readonly HD_720P6000: ChannelFormat
		static readonly HD_1080P2398: ChannelFormat
		static readonly HD_1080P2400: ChannelFormat
		static readonly HD_1080I5000: ChannelFormat
		static readonly HD_1080I5994: ChannelFormat
		static readonly HD_1080I6000: ChannelFormat
		static readonly HD_1080P2500: ChannelFormat
		static readonly HD_1080P2997: ChannelFormat
		static readonly HD_1080P3000: ChannelFormat
		static readonly HD_1080P5000: ChannelFormat
		static readonly HD_1080P5994: ChannelFormat
		static readonly HD_1080P6000: ChannelFormat
		static readonly UHD_1556P2398: ChannelFormat
		static readonly UHD_1556P2400: ChannelFormat
		static readonly UHD_1556P2500: ChannelFormat
		static readonly DCI_1080P2398: ChannelFormat
		static readonly DCI_1080P2400: ChannelFormat
		static readonly DCI_1080P2500: ChannelFormat
		static readonly UHD_2160P2398: ChannelFormat
		static readonly UCH_2160P2400: ChannelFormat
		static readonly UHD_2160P2500: ChannelFormat
		static readonly UHD_2160P2997: ChannelFormat
		static readonly UHD_2160P3000: ChannelFormat
		static readonly UHD_2160P5000: ChannelFormat
		static readonly UHD_2160P5994: ChannelFormat
		static readonly UHD_2160P6000: ChannelFormat
		static readonly DCI_2160P2398: ChannelFormat
		static readonly DCI_2160P2400: ChannelFormat
		static readonly DCI_2160P2500: ChannelFormat
	}
	/**
	 *
	 */
	class ChannelLayout extends AbstractEnum {
	}
}

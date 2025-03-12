import React, { useEffect, useRef, CSSProperties } from 'react'

export interface AdjustLabelFitProps {
	/**
	 * The text label to display and adjust
	 */
	label: string

	/**
	 * The available width for the text in any valid CSS width format (px, vw, %, etc.)
	 * If not specified, it will use the parent container's width
	 */
	width?: string | number

	/**
	 * Optional font family (defaults to the parent element's font)
	 */
	fontFamily?: string

	/**
	 * Initial font size in any valid CSS unit (px, pt, rem, etc.)
	 * Default is inherited from parent
	 */
	fontSize?: string | number

	/**
	 * Minimum font size in percentage relative to fontSize (for auto-scaling)
	 * Default is 50
	 */
	minFontSize?: number

	/**
	 * Maximum font size in percentage relative to fontSize (for auto-scaling)
	 * Default is 120
	 */
	maxFontSize?: number

	/**
	 * Minimum letter spacing in pixels
	 * Default is -1px
	 */
	minLetterSpacing?: number

	/**
	 * Additional CSS styles for the container
	 */
	containerStyle?: CSSProperties

	/**
	 * Additional CSS styles for the label
	 */
	labelStyle?: CSSProperties

	/**
	 * Additional class name for the container
	 */
	className?: string

	/**
	 * Hard cut length of the text if it doesn't fit
	 * When unset, it will wrap text per letter
	 */
	hardCutText?: boolean
}

/**
 * A component that automatically adjusts text to fit within a specified width
 * using font size scaling, variable font width adjustment, and letter spacing.
 */
export const AdjustLabelFit: React.FC<AdjustLabelFitProps> = ({
	label,
	width,
	fontFamily,
	fontSize,
	minFontSize = 50,
	maxFontSize = 120,
	minLetterSpacing = -1,
	containerStyle = {},
	labelStyle = {},
	className = '',
	hardCutText = false,
}) => {
	const labelRef = useRef<HTMLSpanElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)

	// Convert to CSS values:
	const widthValue = typeof width === 'number' ? `${width}px` : width
	const fontSizeValue = typeof fontSize === 'number' ? `${fontSize}px` : fontSize
	const finalContainerStyle: CSSProperties = {
		display: 'block',
		overflow: 'hidden',
		...containerStyle,
		...(widthValue ? { width: widthValue } : {}),
		...(hardCutText ? {} : { wordBreak: 'break-all' }),
	}

	// Label style - add optional font settings
	const finalLabelStyle: CSSProperties = {
		display: 'inline-block',
		...labelStyle,
		...(fontFamily ? { fontFamily } : {}),
		...(fontSizeValue ? { fontSize: fontSizeValue } : {}),
	}

	const adjustTextToFit = () => {
		const labelElement = labelRef.current
		const containerElement = containerRef.current

		if (!labelElement || !containerElement) return

		const DEFAULT_WIDTH = 100
		labelElement.style.letterSpacing = '0px'

		labelElement.style.fontVariationSettings = `'wdth' ${DEFAULT_WIDTH}`

		// Reset label content if it was cut
		labelElement.textContent = label

		// Reset font size to initial value if specified, or to computed style if not
		if (fontSizeValue) {
			labelElement.style.fontSize = fontSizeValue
		} else {
			// Use computed style if no fontSize was specified
			const computedStyle = window.getComputedStyle(labelElement)
			const initialFontSize = computedStyle.fontSize
			labelElement.style.fontSize = initialFontSize
		}

		// Force reflow to ensure measurements are accurate
		void labelElement.offsetWidth

		// Measure the container and text widths
		const containerWidth = containerElement.clientWidth
		const textWidth = labelElement.getBoundingClientRect().width

		if (textWidth <= containerWidth) {
			const currentFontSize = parseFloat(window.getComputedStyle(labelElement).fontSize)
			const scaleFactor = containerWidth / textWidth
			const newFontSize = Math.min(currentFontSize * scaleFactor, maxFontSize)

			labelElement.style.fontSize = `${newFontSize}px`

			// Re-center text vertically if needed
			labelElement.style.lineHeight = '1'

			return
		}

		const currentFontSize = parseFloat(window.getComputedStyle(labelElement).fontSize)
		const scaleFactor = containerWidth / textWidth
		const newFontSize = Math.max(currentFontSize * scaleFactor, minFontSize)
		labelElement.style.fontSize = `${newFontSize}px`

		// Remeasure after font size adjustment
		void labelElement.offsetWidth
		const newTextWidth = labelElement.getBoundingClientRect().width

		// If text now fits with font size adjustment alone, we're done
		if (newTextWidth <= containerWidth) return

		const widthRatio = containerWidth / newTextWidth
		let currentWidth = DEFAULT_WIDTH * widthRatio

		// Use a reasonable range for width variation
		currentWidth = Math.max(currentWidth, 75) // minimum 75%
		currentWidth = Math.min(currentWidth, 110) // maximum 110%

		labelElement.style.fontVariationSettings = `'wdth' ${currentWidth}`

		// Remeasure text width after adjustment:
		void labelElement.offsetWidth
		const adjustedTextWidth = labelElement.getBoundingClientRect().width

		// Letter spacing if text still overflows
		if (adjustedTextWidth > containerWidth) {
			const overflow = adjustedTextWidth - containerWidth
			const letterCount = label.length - 1 // Spaces between letters
			let letterSpacing = letterCount > 0 ? -overflow / letterCount : 0

			letterSpacing = Math.max(letterSpacing, minLetterSpacing)
			labelElement.style.letterSpacing = `${letterSpacing}px`

			// Hard cut text if enabled and letterspacing is not enough:
			if (hardCutText) {
				void labelElement.offsetWidth
				const finalTextWidth = labelElement.getBoundingClientRect().width
				if (finalTextWidth > containerWidth) {
					const ratio = containerWidth / finalTextWidth
					const visibleChars = Math.floor(label.length * ratio) - 1
					labelElement.textContent = label.slice(0, Math.max(visibleChars, 1))
				}
			} else {
				// Apply line wrapping per letter if hardCutText is not set
				void labelElement.offsetWidth
				const finalTextWidth = labelElement.getBoundingClientRect().width
				if (finalTextWidth > containerWidth) {
					const currentFontSize = parseFloat(window.getComputedStyle(labelElement).fontSize)
					const minFontSizeValue = currentFontSize * (minFontSize / 100)
					labelElement.style.fontSize = `${minFontSizeValue}px`

					labelElement.textContent = ''

					for (let i = 0; i < label.length; i++) {
						const charSpan = document.createElement('span')
						charSpan.textContent = label[i]
						charSpan.style.display = 'inline-block'
						charSpan.style.wordBreak = 'break-all'
						charSpan.style.whiteSpace = 'normal'
						labelElement.appendChild(charSpan)
					}

					// Apply wrapping styles
					labelElement.style.wordBreak = 'break-all'
					labelElement.style.whiteSpace = 'normal'
				}
			}
		}
	}

	useEffect(() => {
		// Add debouncing for resize events
		let resizeTimer: number
		const handleResize = () => {
			cancelAnimationFrame(resizeTimer)
			resizeTimer = requestAnimationFrame(() => {
				// Reset all styles first before recalculating
				if (labelRef.current) {
					labelRef.current.style.letterSpacing = '0px'
					labelRef.current.style.fontVariationSettings = ''
					labelRef.current.textContent = label
					// Reset the word break and white space properties
					labelRef.current.style.wordBreak = 'normal'
					labelRef.current.style.whiteSpace = 'nowrap'
				}
				adjustTextToFit()
			})
		}

		// Adjust on window resize
		window.addEventListener('resize', handleResize)
		return () => {
			window.removeEventListener('resize', handleResize)
			cancelAnimationFrame(resizeTimer)
		}
	}, [label, width, fontFamily, fontSize, minFontSize, maxFontSize, minLetterSpacing])

	return (
		<div ref={containerRef} className={`adjust-label-fit ${className}`} style={finalContainerStyle}>
			<span ref={labelRef} style={finalLabelStyle}>
				{label}
			</span>
		</div>
	)
}

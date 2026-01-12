import { Save, FileText, Copy, Twitter } from 'lucide';

/**
 * Initialize vector icons in the UI
 * Replaces the old sprite-based icons with SVG vector icons from Lucide
 */
export function initializeIcons(): void {
	const iconConfig = {
		save: Save,
		new: FileText,
		duplicate: Copy,
		twitter: Twitter,
	};

	Object.entries(iconConfig).forEach(([className, icon]) => {
		const element = document.querySelector(`.${className}.function`);
		if (element) {
			// Generate SVG string from icon
			const svgString = icon.toSvg({
				width: 24,
				height: 24,
				'stroke-width': 2,
			});

			// Set the SVG as innerHTML
			element.innerHTML = svgString;
		}
	});
}

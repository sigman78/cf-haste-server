import { Save, FileText, Copy, Twitter, createElement } from 'lucide';

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
			// Create SVG element from icon node
			const svgElement = createElement(icon, {
				width: 24,
				height: 24,
				'stroke-width': 2,
			});

			// Clear and append the SVG element
			element.innerHTML = '';
			element.appendChild(svgElement);
		}
	});
}

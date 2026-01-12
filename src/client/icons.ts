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

	Object.entries(iconConfig).forEach(([className, IconComponent]) => {
		const element = document.querySelector(`.${className}.function`);
		if (element) {
			// Create the icon
			const icon = IconComponent.createElement({
				width: 24,
				height: 24,
				strokeWidth: 2,
			});

			// Clear existing content and append icon
			element.innerHTML = '';
			element.appendChild(icon);
		}
	});
}

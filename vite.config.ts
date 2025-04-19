import Inspect from 'vite-plugin-inspect';
import ViteSvgSpritePlugin from './plugins/vite-svg-sprite';
// import tailwindcss from '@tailwindcss/vite';

export default {
	base: './',
	plugins: [
		Inspect(),
		ViteSvgSpritePlugin({
			iconsDir: 'public/assets/icons',
			outputSprite: 'public/icon-sprite.svg',
		}),
		// tailwindcss(),
	],
};

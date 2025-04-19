import ElementCreator from '../../utils/element-creator';
import { BaseComponent } from '../base/component';

export class FooterComponent extends BaseComponent {
	constructor() {
		super({
			tag: 'footer',
			classes: ['footer'],
		});
	}

	protected createView(): HTMLElement {
		const creator = new ElementCreator({
			tag: 'footer',
			classes: [
				'footer container mx-auto flex w-full justify-between px-4 py-2',
			],
			children: [
				{
					tag: 'div',
					classes: 'footer__school',
					children: [{ tag: 'span', content: 'RSSchool' }],
				},
				{
					tag: 'a',
					classes: 'footer__author',
					attributes: {
						href: 'https://github.com/Zilusion',
						target: '_blank',
					},
					content: 'Zilusion',
				},
				{
					tag: 'span',
					classes: 'footer__year',
					content: '2025',
				},
			],
		});

		return creator.getElement() as HTMLElement;
	}
}

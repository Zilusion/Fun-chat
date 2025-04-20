import ElementCreator from '../../../utils/element-creator';
import { BaseComponent } from '../../base/component';

import classes from './_about-page.module.scss';

export class AboutPage extends BaseComponent {
	private container: HTMLElement | null = null;
	private title: HTMLHeadingElement | null = null;
	private creator: HTMLElement | null = null;
	private goBackButton: HTMLButtonElement | null = null;

	constructor() {
		super({
			tag: 'main',
			classes: classes['about-page'],
		});
		this.render();
		this.addEventListeners();
	}

	protected render(): void {
		this.container = ElementCreator.create({
			tag: 'div',
			classes: ['container', classes['container']],
		}) as HTMLElement;

		this.element.append(this.container);

		this.title = ElementCreator.create({
			tag: 'h1',
			content: 'Fun chat',
		}) as HTMLHeadingElement;

		this.creator = ElementCreator.create({
			tag: 'a',
			content: 'Created by Zilusion',
			attributes: {
				href: 'https://github.com/Zilusion',
				target: '_blank',
			},
		}) as HTMLElement;

		this.goBackButton = ElementCreator.create({
			tag: 'button',
			classes: ['button', 'button--outline'],
			content: 'Go back',
			attributes: { type: 'button' },
		}) as HTMLButtonElement;

		this.container.append(this.title, this.creator, this.goBackButton);
	}

	private addEventListeners(): void {
		this.goBackButton?.addEventListener('click', () => {
			globalThis.location.hash = '#/login';
		});
	}
}

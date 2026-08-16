import ElementCreator from '../../../utils/element-creator';
import { BaseComponent } from '../../base/component';

import classes from './_about-page.module.scss';

export class AboutPage extends BaseComponent {
	private container: HTMLElement | null = null;
	private title: HTMLHeadingElement | null = null;
	private text: HTMLElement | null = null;
	private creator: HTMLElement | null = null;
	private goBackButton: HTMLButtonElement | null = null;

	constructor() {
		super({
			tag: 'main',
			classes: classes['page'],
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
			classes: classes['title'],
			content: 'Fun chat',
		}) as HTMLHeadingElement;

		this.text = ElementCreator.create({
			tag: 'p',
			classes: classes['text'],
			content:
				'Fun chat is a small application for communication. It was created as part of the RS School training course. Thank you for visiting this page! Wish you good luck in all your endeavors!',
		}) as HTMLElement;

		this.creator = ElementCreator.create({
			tag: 'a',
			classes: classes['creator'],
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

		this.container.append(
			this.title,
			this.text,
			this.creator,
			this.goBackButton,
		);
	}

	private addEventListeners(): void {
		this.goBackButton?.addEventListener('click', () => {
			globalThis.location.hash = '#/login';
		});
	}
}

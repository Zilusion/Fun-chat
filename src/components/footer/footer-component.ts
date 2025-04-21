import ElementCreator from '../../utils/element-creator';
import { BaseComponent } from '../base/component';

import classes from './_footer-component.module.scss';

export class FooterComponent extends BaseComponent {
	private container: HTMLElement | null = null;
	private school: HTMLElement | null = null;
	private schoolLogo: Element | null = null;
	private schoolLink: HTMLElement | null = null;
	private creator: HTMLElement | null = null;
	private year: HTMLElement | null = null;

	constructor() {
		super({
			tag: 'footer',
			classes: classes['footer'],
		});

		this.render();
	}

	public destroy(): void {
		super.destroy();
	}

	protected render(): void {
		this.container = ElementCreator.create({
			tag: 'div',
			classes: ['container', classes['container']],
		}) as HTMLElement;

		this.school = ElementCreator.create({
			tag: 'div',
			classes: classes['school'],
		}) as HTMLElement;

		this.schoolLogo = ElementCreator.create({
			tag: 'svg',
			classes: classes['school-logo'],
			namespace: 'http://www.w3.org/2000/svg',
			children: [
				{
					tag: 'use',
					namespace: 'http://www.w3.org/2000/svg',
					attributes: {
						'xlink:href': '/icon-sprite.svg#rss',
					},
				},
			],
		});

		this.schoolLink = ElementCreator.create({
			tag: 'a',
			classes: classes['school-link'],
			attributes: {
				href: 'https://rs.school/',
				target: '_blank',
			},
			content: 'RS School',
		}) as HTMLElement;

		this.school.append(this.schoolLogo, this.schoolLink);

		this.creator = ElementCreator.create({
			tag: 'a',
			classes: classes['creator'],
			attributes: {
				href: 'https://github.com/Zilusion',
				target: '_blank',
			},
			content: 'Zilusion',
		}) as HTMLElement;

		this.year = ElementCreator.create({
			tag: 'span',
			classes: classes['year'],
			content: '2025',
		}) as HTMLElement;

		this.container.append(this.school, this.creator, this.year);

		this.appendChildren([this.container]);
	}
}

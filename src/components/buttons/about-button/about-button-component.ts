import ElementCreator from '../../../utils/element-creator';
import { BaseComponent } from '../../base/component';

export class AboutButtonComponent extends BaseComponent {
	private button: HTMLButtonElement | null = null;
	private readonly customClasses: string[];

	constructor(customClasses: string | string[] = []) {
		super();
		this.customClasses = Array.isArray(customClasses)
			? customClasses
			: [customClasses].filter(Boolean);
		this.addEventListeners();
	}

	public destroy(): void {
		this.button?.removeEventListener('click', this.handleButtonClick);
		super.destroy();
	}

	protected createView(): HTMLElement {
		const allClasses = [
			'button',
			'button--outline',
			...(this.customClasses || []),
		];
		this.button = ElementCreator.create({
			tag: 'button',
			classes: allClasses,
			content: 'About',
			attributes: { type: 'button' },
		}) as HTMLButtonElement;

		return this.button;
	}

	private addEventListeners(): void {
		this.element.addEventListener(
			'click',
			this.handleButtonClick.bind(this),
		);
	}

	private handleButtonClick = (): void => {
		console.log('Info button clicked');
		globalThis.location.hash = '#/about';
	};
}

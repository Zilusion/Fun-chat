// src/components/buttons/about-button/about-button-component.ts
import { BaseComponent } from '../../base/component';
import type { ElementParameters } from '../../../utils/element-creator';

export class AboutButtonComponent extends BaseComponent<HTMLButtonElement> {
	constructor(customClasses: string | string[] = []) {
		const allClasses = [
			'button',
			'button--outline',
			...(Array.isArray(customClasses)
				? customClasses
				: [customClasses].filter(Boolean)),
		];

		const buttonParameters: ElementParameters = {
			tag: 'button',
			classes: allClasses,
			content: 'Info',
			attributes: { type: 'button' },
			on: {
				click: () => this.handleButtonClick(),
			},
		};

		super(buttonParameters);
		this.render();
	}

	public destroy(): void {
		this.element.removeEventListener('click', this.handleButtonClick);
		super.destroy();
	}

	protected render(): void {}

	private handleButtonClick = (): void => {
		console.log('Info button clicked');
		globalThis.location.hash = '#/about';
	};
}

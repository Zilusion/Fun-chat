// src/components/buttons/logout-button/logout-button-component.ts
import type { EventBus } from '../../../services/event-bus';
import { BaseComponent } from '../../base/component';
import type { ElementParameters } from '../../../utils/element-creator';

export class LogoutButtonComponent extends BaseComponent<HTMLButtonElement> {
	private readonly eventBus: EventBus;

	constructor(eventBus: EventBus, customClasses: string | string[] = []) {
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
			content: 'Logout',
			attributes: { type: 'button' },
			on: {
				click: () => this.handleButtonClick(),
			},
		};

		super(buttonParameters);
		this.eventBus = eventBus;
		this.render();
	}
	public destroy(): void {
		this.element.removeEventListener('click', this.handleButtonClick);
		super.destroy();
	}

	protected render(): void {}

	private handleButtonClick = (): void => {
		console.log('Logout button clicked, publishing ui:logoutRequest');
		this.eventBus.publish('ui:logoutRequest');
	};
}

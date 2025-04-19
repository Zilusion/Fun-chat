import type { EventBus } from '../../../services/event-bus';
import ElementCreator from '../../../utils/element-creator';
import { BaseComponent } from '../../base/component';

export class LogoutButtonComponent extends BaseComponent {
	private readonly eventBus: EventBus;

	private button: HTMLButtonElement | null = null;
	private readonly customClasses: string[];

	constructor(eventBus: EventBus, customClasses: string | string[] = []) {
		super();
		this.eventBus = eventBus;
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
			content: 'Logout',
			attributes: { type: 'button' },
		}) as HTMLButtonElement;

		return this.button;
	}

	private addEventListeners(): void {
		this.element.addEventListener('click', this.handleButtonClick);
	}

	private handleButtonClick = (): void => {
		console.log('Logout button clicked, publishing ui:logoutRequest');
		this.eventBus.publish('ui:logoutRequest');
	};
}

import type { EventBus } from '../../services/event-bus';
import type { StateService } from '../../services/state-service';
import ElementCreator from '../../utils/element-creator';
import { BaseComponent } from '../base/component';
import { AboutButtonComponent } from '../buttons/about-button/about-button-component';
import { LogoutButtonComponent } from '../buttons/logout-button/logout-button-component';

import classes from './_header-component.module.scss';

export class HeaderComponent extends BaseComponent {
	private readonly eventBus: EventBus;
	private readonly stateService: StateService;

	private header: HTMLElement | null = null;
	private container: HTMLElement | null = null;
	private currentUserElement: HTMLDivElement | null = null;
	private buttonsContainer: HTMLDivElement | null = null;
	private infoButton: AboutButtonComponent | null = null;
	private logoutButton: LogoutButtonComponent | null = null;

	private unsubscribeCurrentUser: (() => void) | null = null;

	constructor(eventBus: EventBus, stateService: StateService) {
		super();
		this.eventBus = eventBus;
		this.stateService = stateService;

		this.configureComponent();
		this.subscribeToStateChanges();
	}

	public destroy(): void {
		this.unsubscribeCurrentUser?.();
		this.infoButton?.destroy();
		this.logoutButton?.destroy();
		super.destroy();
	}

	protected createView(): HTMLElement {
		this.header = ElementCreator.create({
			tag: 'header',
			classes: classes['header'],
		}) as HTMLElement;
		return this.header;
	}

	private configureComponent(): void {
		this.container = ElementCreator.create({
			tag: 'div',
			classes: ['container', classes['container']],
		}) as HTMLElement;
		this.element.append(this.container);

		this.currentUserElement = ElementCreator.create({
			tag: 'div',
			classes: classes['current-user'],
			content: `User: ${this.stateService.getCurrentUser()?.login ?? '...'}`,
		}) as HTMLDivElement;

		this.buttonsContainer = ElementCreator.create({
			tag: 'div',
			classes: classes['buttons'],
		}) as HTMLDivElement;

		this.infoButton = new AboutButtonComponent();

		this.logoutButton = new LogoutButtonComponent(this.eventBus);

		this.buttonsContainer.append(
			this.infoButton.getElement(),
			this.logoutButton.getElement(),
		);

		this.container.append(this.currentUserElement, this.buttonsContainer);
	}

	private subscribeToStateChanges(): void {
		this.unsubscribeCurrentUser = this.eventBus.subscribe(
			'state:currentUserChanged',
			(user) => {
				if (this.currentUserElement) {
					this.currentUserElement.textContent = `User: ${user?.login ?? '...'}`;
				}
			},
		);
	}
}

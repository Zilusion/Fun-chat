// src/components/header/header-component.ts
import type { AuthService } from '../../services/auth-service';
import type { EventBus } from '../../services/event-bus';
import type { StateService } from '../../services/state-service';
import ElementCreator from '../../utils/element-creator';
import { BaseComponent } from '../base/component';
import { AboutButtonComponent } from '../buttons/about-button/about-button-component';
import { LogoutButtonComponent } from '../buttons/logout-button/logout-button-component';

import classes from './_header-component.module.scss';

export class HeaderComponent extends BaseComponent {
	private readonly authService: AuthService;
	private readonly eventBus: EventBus;
	private readonly stateService: StateService;

	private container: HTMLElement | null = null;
	private currentUserElement: HTMLElement | null = null;
	private appNameElement: HTMLElement | null = null;
	private buttonsContainer: HTMLElement | null = null;

	private infoButton: AboutButtonComponent | null = null;
	private logoutButton: LogoutButtonComponent | null = null;

	private unsubscribeCurrentUser: (() => void) | null = null;

	constructor(
		authService: AuthService,
		eventBus: EventBus,
		stateService: StateService,
	) {
		super({
			tag: 'header',
			classes: classes['header'],
		});

		this.authService = authService;
		this.eventBus = eventBus;
		this.stateService = stateService;

		this.render();

		this.updateCurrentUserDisplay();
		this.subscribeToStateChanges();
	}

	public destroy(): void {
		this.unsubscribeCurrentUser?.();
		this.infoButton?.destroy();
		this.logoutButton?.destroy();
		super.destroy();
	}

	protected render(): void {
		console.log('HeaderComponent rendering static structure...');
		this.container = ElementCreator.create({
			tag: 'div',
			classes: ['container', classes['container']],
		}) as HTMLElement;

		this.currentUserElement = ElementCreator.create({
			tag: 'div',
			classes: classes['current-user'],
			content: 'User: ...',
		}) as HTMLElement;

		this.appNameElement = ElementCreator.create({
			tag: 'div',
			classes: classes['app-name'],
			content: 'Fun Chat',
		}) as HTMLElement;

		this.buttonsContainer = ElementCreator.create({
			tag: 'div',
			classes: classes['buttons'],
		}) as HTMLElement;

		this.infoButton = new AboutButtonComponent();
		this.logoutButton = new LogoutButtonComponent(this.eventBus);

		this.buttonsContainer.append(
			this.infoButton.getElement(),
			this.logoutButton.getElement(),
		);

		this.container.append(
			this.currentUserElement,
			this.appNameElement,
			this.buttonsContainer,
		);

		this.appendChildren([this.container]);
	}

	private subscribeToStateChanges(): void {
		this.unsubscribeCurrentUser = this.eventBus.subscribe(
			'state:currentUserChanged',
			() => this.updateCurrentUserDisplay(),
		);
	}

	private updateCurrentUserDisplay(): void {
		if (this.currentUserElement) {
			const userName = this.stateService.getCurrentUser()?.login ?? '...';
			console.log(
				`HeaderComponent updating user display to: ${userName}`,
			);
			this.currentUserElement.textContent = `User: ${userName}`;
		} else {
			console.warn(
				'HeaderComponent: currentUserElement not found for update.',
			);
		}
	}
}

import type { AuthService } from '../../../services/auth-service';
import type { EventBus } from '../../../services/event-bus';
import type { StateService } from '../../../services/state-service';
import ElementCreator from '../../../utils/element-creator';
import { BaseComponent } from '../../base/component';
import { ContactsComponent } from '../../contacts/contacts-component';
import { HeaderComponent } from '../../header/header-component';

import classes from './_main-page.module.scss';

export class MainPage extends BaseComponent {
	private readonly authService: AuthService;
	private readonly eventBus: EventBus;
	private readonly stateService: StateService;

	private page: HTMLElement | null = null;
	private header: HeaderComponent | null = null;
	private contacts: ContactsComponent | null = null;

	constructor(
		authService: AuthService,
		eventBus: EventBus,
		stateService: StateService,
	) {
		super();
		this.authService = authService;
		this.eventBus = eventBus;
		this.stateService = stateService;

		this.configureComponent();
	}

	protected createView(): HTMLElement {
		this.page = ElementCreator.create({
			tag: 'main',
			classes: classes['page'],
		}) as HTMLElement;
		return this.page;
	}

	private configureComponent(): void {
		this.header = new HeaderComponent(this.eventBus, this.stateService);

		this.contacts = new ContactsComponent(this.eventBus, this.stateService);

		this.element.append(
			this.header.getElement(),
			this.contacts.getElement(),
		);
		// this.container = ElementCreator.create({
		// 	tag: 'div',
		// 	classes: ['container', classes['login-page-container']],
		// }) as HTMLElement;
		// this.element.append(this.container);
	}
}

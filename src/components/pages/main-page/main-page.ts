import type { AuthService } from '../../../services/auth-service';
import type { EventBus } from '../../../services/event-bus';
import type { MessageService } from '../../../services/message-service';
import type { StateService } from '../../../services/state-service';
// import ElementCreator from '../../../utils/element-creator';
import { BaseComponent } from '../../base/component';
import { ChatAreaComponent } from '../../chat-area/chat-area-component';
import { ContactsComponent } from '../../contacts/contacts-component';
import { HeaderComponent } from '../../header/header-component';

import classes from './_main-page.module.scss';

export class MainPage extends BaseComponent {
	private readonly authService: AuthService;
	private readonly eventBus: EventBus;
	private readonly stateService: StateService;
	private readonly messageService: MessageService;

	private header: HeaderComponent | null = null;
	private contacts: ContactsComponent | null = null;
	private chatArea: ChatAreaComponent | null = null;

	constructor(
		authService: AuthService,
		eventBus: EventBus,
		stateService: StateService,
		messageService: MessageService,
	) {
		super({
			tag: 'main',
			classes: classes['page'],
		});

		this.authService = authService;
		this.eventBus = eventBus;
		this.stateService = stateService;
		this.messageService = messageService;

		this.render();
	}

	protected render(): void {
		this.header = new HeaderComponent(
			this.authService,
			this.eventBus,
			this.stateService,
		);

		this.contacts = new ContactsComponent(this.eventBus, this.stateService);
		this.chatArea = new ChatAreaComponent(
			this.eventBus,
			this.stateService,
			this.messageService,
		);
		this.element.append(
			this.header.getElement(),
			this.contacts.getElement(),
			this.chatArea.getElement(),
		);
		// this.container = ElementCreator.create({
		// 	tag: 'div',
		// 	classes: ['container', classes['login-page-container']],
		// }) as HTMLElement;
		// this.element.append(this.container);
	}
}

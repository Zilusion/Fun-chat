import type { EventBus } from '../../../services/event-bus';
import type { MessageService } from '../../../services/message-service';
import type { StateService } from '../../../services/state-service';
import { BaseComponent } from '../../base/component';
import { ChatAreaComponent } from '../../chat-area/chat-area-component';
import { ContactsComponent } from '../../contacts/contacts-component';
import { FooterComponent } from '../../footer/footer-component';
import { HeaderComponent } from '../../header/header-component';

import classes from './_main-page.module.scss';

export class MainPage extends BaseComponent {
	private readonly eventBus: EventBus;
	private readonly stateService: StateService;
	private readonly messageService: MessageService;

	private header: HeaderComponent | null = null;
	private contacts: ContactsComponent | null = null;
	private chatArea: ChatAreaComponent | null = null;
	private footer: FooterComponent | null = null;

	constructor(
		eventBus: EventBus,
		stateService: StateService,
		messageService: MessageService,
	) {
		super({
			tag: 'main',
			classes: classes['page'],
		});

		this.eventBus = eventBus;
		this.stateService = stateService;
		this.messageService = messageService;

		this.render();
	}

	protected render(): void {
		this.header = new HeaderComponent(this.eventBus, this.stateService);
		this.header.addClass(classes['header']);

		this.contacts = new ContactsComponent(this.eventBus, this.stateService);
		this.contacts.addClass(classes['contacts']);
		this.chatArea = new ChatAreaComponent(
			this.eventBus,
			this.stateService,
			this.messageService,
		);
		this.chatArea.addClass(classes['chat-area']);

		this.footer = new FooterComponent();
		this.footer.addClass(classes['footer']);

		this.element.append(
			this.header.getElement(),
			this.contacts.getElement(),
			this.chatArea.getElement(),
			this.footer.getElement(),
		);
	}
}

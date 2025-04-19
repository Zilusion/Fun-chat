import type { EventBus } from '../../services/event-bus';
import type { StateService } from '../../services/state-service';
import type { UserInfo } from '../../types/api-types';
import ElementCreator from '../../utils/element-creator';
import { BaseComponent } from '../base/component';

import classes from './_contacts-component.module.scss';

type ContactItem = {
	user: UserInfo;
	element: HTMLElement;
};

export class ContactsComponent extends BaseComponent {
	private readonly eventBus: EventBus;
	private readonly stateService: StateService;

	private contactsElement: HTMLElement | null = null;
	private searchInput: HTMLInputElement | null = null;
	private contactsListElement: HTMLUListElement | null = null;

	private allUsers: UserInfo[] = [];
	private renderedContactItems: Map<string, ContactItem> = new Map();
	private searchTerm = '';
	private currentUserLogin: string | null = null;

	private unsubscribeFunctions: (() => void)[] = [];

	constructor(eventBus: EventBus, stateService: StateService) {
		super();
		this.eventBus = eventBus;
		this.stateService = stateService;

		this.currentUserLogin =
			this.stateService.getCurrentUser()?.login ?? null;
		this.allUsers = this.getSortedUsers(this.stateService.getUsers());

		this.configureComponent();
		// this.renderFilteredList();
		this.subscribeToEvents();
	}

	public destroy(): void {
		this.unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
		this.unsubscribeFunctions = [];
		super.destroy();
	}

	protected createView(): HTMLElement {
		this.contactsElement = ElementCreator.create({
			tag: 'aside',
			classes: classes['contacts'],
		}) as HTMLElement;

		return this.contactsElement;
	}

	private configureComponent(): void {
		this.searchInput = ElementCreator.create({
			tag: 'input',
			classes: classes['search-input'],
			attributes: {
				type: 'search',
				placeholder: 'Search contacts...',
			},
			on: {
				input: this.handleSearchInput.bind(this),
			},
		}) as HTMLInputElement;

		this.contactsListElement = ElementCreator.create({
			tag: 'ul',
			classes: classes['contacts-list'],
		}) as HTMLUListElement;

		this.element.append(this.searchInput, this.contactsListElement);
	}

	private subscribeToEvents(): void {
		const unsubscribeUsers = this.eventBus.subscribe(
			'state:userListUpdated',
			(users: UserInfo[]) => {
				this.allUsers = this.getSortedUsers(users);
				this.renderFilteredList();
			},
		);
		this.unsubscribeFunctions.push(unsubscribeUsers);

		const unsubscribeCurrentUser = this.eventBus.subscribe(
			'state:currentUserChanged',
			(user) => {
				const previousLogin = this.currentUserLogin;
				this.currentUserLogin = user?.login ?? null;
				if (previousLogin !== this.currentUserLogin) {
					this.renderFilteredList();
				}
			},
		);
		this.unsubscribeFunctions.push(unsubscribeCurrentUser);

		// TODO: Подписаться на 'state:unreadCountsUpdated'
	}

	private handleSearchInput(event: Event): void {
		const input = event.target as HTMLInputElement;
		this.searchTerm = input.value.trim().toLowerCase();
		this.renderFilteredList();
	}

	private getSortedUsers(users: UserInfo[]): UserInfo[] {
		return [...users].sort((a, b) => {
			if (a.login === this.currentUserLogin) return 1;
			if (b.login === this.currentUserLogin) return -1;

			if (a.isLogined !== b.isLogined) {
				return a.isLogined ? -1 : 1;
			}
			return a.login.localeCompare(b.login);
		});
	}

	private renderFilteredList(): void {
		if (!this.contactsListElement) return;
		console.log('>>> renderFilteredList');

		const filteredUsers = this.allUsers.filter(
			(user) =>
				user.login !== this.currentUserLogin &&
				user.login.toLowerCase().includes(this.searchTerm),
		);

		this.contactsListElement.innerHTML = '';
		this.renderedContactItems.clear();

		filteredUsers.forEach((user) => {
			const contactItem = this.createContactItemElement(user);
			this.contactsListElement?.append(contactItem);
			this.renderedContactItems.set(user.login, {
				user,
				element: contactItem,
			});
		});
	}

	private createContactItemElement(user: UserInfo): HTMLElement {
		const itemClasses = [
			classes['contacts-item'],
			user.isLogined
				? classes['contacts-item--online']
				: classes['contacts-item--offline'],
		];

		const contactItemParameters: Parameters<
			typeof ElementCreator.create
		>[0] = {
			tag: 'li',
			classes: itemClasses,
			content: user.login,
			attributes: { 'data-userid': user.login },
			on: {
				click: () => {
					console.log(`Clicked on user: ${user.login}`);
					this.eventBus.publish('ui:selectChat', {
						userId: user.login,
					});
				},
			},
		};
		return ElementCreator.create(contactItemParameters) as HTMLElement;
	}

	// TODO: Метод для обновления счетчика непрочитанных для конкретного пользователя
	// private updateUnreadBadge(userId: string, count: number): void {
	//   const item = this.renderedContactItems.get(userId);
	//   if (item) {
	//     // Найти или создать элемент для счетчика внутри item.element и обновить его
	//   }
	// }
}

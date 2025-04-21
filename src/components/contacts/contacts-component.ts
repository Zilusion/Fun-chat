import type { EventBus } from '../../services/event-bus';
import type { StateService } from '../../services/state-service';
import type { UserInfo } from '../../types/api-types';
import ElementCreator from '../../utils/element-creator';
import { BaseComponent } from '../base/component';

import classes from './_contacts-component.module.scss';

type ContactItemElements = {
	item: HTMLElement;
	badge: HTMLElement | null;
};
type ContactItemData = {
	user: UserInfo;
	elements: ContactItemElements;
};

export class ContactsComponent extends BaseComponent {
	private readonly eventBus: EventBus;
	private readonly stateService: StateService;

	private searchInput!: HTMLInputElement;
	private contactsListElement!: HTMLUListElement;

	private allUsers: UserInfo[] = [];
	private renderedContactItems: Map<string, ContactItemData> = new Map();
	private searchTerm = '';
	private currentUserLogin: string | null = null;
	private currentUnreadCounts: Map<string, number> = new Map();

	private unsubscribeFunctions: (() => void)[] = [];

	constructor(eventBus: EventBus, stateService: StateService) {
		super({ tag: 'aside', classes: classes['contacts'] });
		this.eventBus = eventBus;
		this.stateService = stateService;

		this.currentUserLogin =
			this.stateService.getCurrentUser()?.login ?? null;
		this.allUsers = this.getSortedUsers(this.stateService.getUsers());
		this.currentUnreadCounts = new Map(
			this.stateService.getStateSnapshot().unreadCounts,
		);

		this.render();
	}

	public destroy(): void {
		this.unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
		this.unsubscribeFunctions = [];
		super.destroy();
	}

	protected render(): void {
		this.searchInput = ElementCreator.create({
			tag: 'input',
			classes: classes['search-input'],
			attributes: {
				type: 'search',
				placeholder: 'Search contacts...',
				id: 'search-input',
			},
			on: { input: this.handleSearchInput.bind(this) },
		}) as HTMLInputElement;

		this.contactsListElement = ElementCreator.create({
			tag: 'ul',
			classes: classes['contacts-list'],
		}) as HTMLUListElement;

		this.appendChildren([this.searchInput, this.contactsListElement]);
		this.renderFilteredList();
		this.subscribeToEvents();
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

		const unsubscribeUnread = this.eventBus.subscribe(
			'state:unreadCountsUpdated',
			(newCounts: Map<string, number>) => {
				console.log(
					'ContactsComponent: Received unread counts update',
					newCounts,
				);
				this.currentUnreadCounts = newCounts;
				this.renderedContactItems.forEach((_, userId) => {
					this.updateUnreadBadge(userId, newCounts.get(userId) ?? 0);
				});
			},
		);
		this.unsubscribeFunctions.push(unsubscribeUnread);
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

		const filteredUsers = this.allUsers.filter(
			(user) =>
				user.login !== this.currentUserLogin &&
				user.login.toLowerCase().includes(this.searchTerm),
		);

		this.contactsListElement.innerHTML = '';
		this.renderedContactItems.clear();
		const fragment = document.createDocumentFragment();

		filteredUsers.forEach((user) => {
			const contactElements = this.createContactItemElements(user);
			fragment.append(contactElements.item);
			this.renderedContactItems.set(user.login, {
				user,
				elements: contactElements,
			});
			this.updateUnreadBadge(
				user.login,
				this.currentUnreadCounts.get(user.login) ?? 0,
			);
		});

		this.contactsListElement.append(fragment);
	}

	private createContactItemElements(user: UserInfo): ContactItemElements {
		const itemClasses = [
			classes['contacts-item'],
			user.isLogined
				? classes['contacts-item--online']
				: classes['contacts-item--offline'],
		];

		const unreadBadge = ElementCreator.create({
			tag: 'span',
			classes: [classes['unread-badge'], classes['hidden']],
			attributes: { 'aria-hidden': 'true' },
		}) as HTMLElement;

		const contactItemElement = ElementCreator.create({
			tag: 'li',
			classes: itemClasses,
			attributes: { 'data-userid': user.login },
			on: { click: () => this.handleContactClick(user.login) },
			children: [
				ElementCreator.create({ tag: 'span', content: user.login }),
				unreadBadge,
			],
		}) as HTMLElement;

		return { item: contactItemElement, badge: unreadBadge };
	}

	private handleContactClick(userId: string): void {
		console.log(`Clicked on user: ${userId}`);
		this.eventBus.publish('ui:selectChat', { userId });
		this.updateActiveClass(userId);
	}

	private updateActiveClass(selectedUserId: string | null): void {
		this.renderedContactItems.forEach((itemData, userId) => {
			const activeClass = classes['contacts-item--active'];
			if (activeClass) {
				itemData.elements.item.classList.toggle(
					activeClass,
					userId === selectedUserId,
				);
			}
		});
	}

	private updateUnreadBadge(userId: string, count: number): void {
		const itemData = this.renderedContactItems.get(userId);
		const badgeElement = itemData?.elements.badge;

		if (badgeElement) {
			const countText = count > 0 ? String(count) : '';
			const isHidden = count <= 0;

			badgeElement.textContent = countText;
			badgeElement.classList.toggle(
				classes['hidden'] ?? 'hidden',
				isHidden,
			);
			badgeElement.setAttribute('aria-hidden', String(isHidden));

			const hasUnreadClass = classes['contacts-item--unread'];
			if (hasUnreadClass) {
				itemData.elements.item.classList.toggle(
					hasUnreadClass,
					!isHidden,
				);
			}
		}
	}
}

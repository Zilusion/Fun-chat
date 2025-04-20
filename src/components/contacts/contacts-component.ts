// import type { EventBus } from '../../services/event-bus';
// import type { StateService } from '../../services/state-service';
// import type { UserInfo } from '../../types/api-types';
// import ElementCreator from '../../utils/element-creator';
// import { BaseComponent } from '../base/component';

// import classes from './_contacts-component.module.scss';

// type ContactItem = {
// 	user: UserInfo;
// 	element: HTMLElement;
// };

// export class ContactsComponent extends BaseComponent {
// 	private readonly eventBus: EventBus;
// 	private readonly stateService: StateService;

// 	private searchInput: HTMLInputElement | null = null;
// 	private contactsListElement: HTMLUListElement | null = null;

// 	private allUsers: UserInfo[] = [];
// 	private renderedContactItems: Map<string, ContactItem> = new Map();
// 	private searchTerm = '';
// 	private currentUserLogin: string | null = null;

// 	private unsubscribeFunctions: (() => void)[] = [];

// 	constructor(eventBus: EventBus, stateService: StateService) {
// 		super({
// 			tag: 'aside',
// 			classes: classes['contacts'],
// 		});

// 		this.eventBus = eventBus;
// 		this.stateService = stateService;

// 		this.render();

// 		this.currentUserLogin =
// 			this.stateService.getCurrentUser()?.login ?? null;
// 		this.allUsers = this.getSortedUsers(this.stateService.getUsers());
// 		// this.renderFilteredList();
// 		this.subscribeToEvents();
// 	}

// 	public destroy(): void {
// 		this.unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
// 		this.unsubscribeFunctions = [];
// 		super.destroy();
// 	}

// 	protected render(): void {
// 		this.searchInput = ElementCreator.create({
// 			tag: 'input',
// 			classes: classes['search-input'],
// 			attributes: {
// 				type: 'search',
// 				placeholder: 'Search contacts...',
// 			},
// 			on: {
// 				input: this.handleSearchInput.bind(this),
// 			},
// 		}) as HTMLInputElement;

// 		this.contactsListElement = ElementCreator.create({
// 			tag: 'ul',
// 			classes: classes['contacts-list'],
// 		}) as HTMLUListElement;

// 		this.element.append(this.searchInput, this.contactsListElement);
// 	}

// 	private subscribeToEvents(): void {
// 		const unsubscribeUsers = this.eventBus.subscribe(
// 			'state:userListUpdated',
// 			(users: UserInfo[]) => {
// 				this.allUsers = this.getSortedUsers(users);
// 				this.renderFilteredList();
// 			},
// 		);
// 		this.unsubscribeFunctions.push(unsubscribeUsers);

// 		const unsubscribeCurrentUser = this.eventBus.subscribe(
// 			'state:currentUserChanged',
// 			(user) => {
// 				const previousLogin = this.currentUserLogin;
// 				this.currentUserLogin = user?.login ?? null;
// 				if (previousLogin !== this.currentUserLogin) {
// 					this.renderFilteredList();
// 				}
// 			},
// 		);
// 		this.unsubscribeFunctions.push(unsubscribeCurrentUser);

// 		// TODO: Подписаться на 'state:unreadCountsUpdated'
// 	}

// 	private handleSearchInput(event: Event): void {
// 		const input = event.target as HTMLInputElement;
// 		this.searchTerm = input.value.trim().toLowerCase();
// 		this.renderFilteredList();
// 	}

// 	private getSortedUsers(users: UserInfo[]): UserInfo[] {
// 		return [...users].sort((a, b) => {
// 			if (a.login === this.currentUserLogin) return 1;
// 			if (b.login === this.currentUserLogin) return -1;

// 			if (a.isLogined !== b.isLogined) {
// 				return a.isLogined ? -1 : 1;
// 			}
// 			return a.login.localeCompare(b.login);
// 		});
// 	}

// 	private renderFilteredList(): void {
// 		if (!this.contactsListElement) return;
// 		console.log('>>> renderFilteredList');

// 		const filteredUsers = this.allUsers.filter(
// 			(user) =>
// 				user.login !== this.currentUserLogin &&
// 				user.login.toLowerCase().includes(this.searchTerm),
// 		);

// 		this.contactsListElement.innerHTML = '';
// 		this.renderedContactItems.clear();

// 		filteredUsers.forEach((user) => {
// 			const contactItem = this.createContactItemElement(user);
// 			this.contactsListElement?.append(contactItem);
// 			this.renderedContactItems.set(user.login, {
// 				user,
// 				element: contactItem,
// 			});
// 		});
// 	}

// 	private createContactItemElement(user: UserInfo): HTMLElement {
// 		const itemClasses = [
// 			classes['contacts-item'],
// 			user.isLogined
// 				? classes['contacts-item--online']
// 				: classes['contacts-item--offline'],
// 		];

// 		const contactItemParameters: Parameters<
// 			typeof ElementCreator.create
// 		>[0] = {
// 			tag: 'li',
// 			classes: itemClasses,
// 			content: user.login,
// 			attributes: { 'data-userid': user.login },
// 			on: {
// 				click: () => {
// 					console.log(`Clicked on user: ${user.login}`);
// 					this.eventBus.publish('ui:selectChat', {
// 						userId: user.login,
// 					});
// 				},
// 			},
// 		};
// 		return ElementCreator.create(contactItemParameters) as HTMLElement;
// 	}

// 	// TODO: Метод для обновления счетчика непрочитанных для конкретного пользователя
// 	// private updateUnreadBadge(userId: string, count: number): void {
// 	//   const item = this.renderedContactItems.get(userId);
// 	//   if (item) {
// 	//     // Найти или создать элемент для счетчика внутри item.element и обновить его
// 	//   }
// 	// }
// }
// src/components/contacts/contacts-component.ts
import type { EventBus } from '../../services/event-bus';
import type { StateService } from '../../services/state-service';
import type { UserInfo } from '../../types/api-types';
import ElementCreator from '../../utils/element-creator';
import { BaseComponent } from '../base/component';

import classes from './_contacts-component.module.scss';

// Интерфейс расширяем, добавляя ссылку на badge
type ContactItemElements = {
	item: HTMLElement;
	badge: HTMLElement | null; // Элемент счетчика
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
	// Теперь храним объект ContactItemData
	private renderedContactItems: Map<string, ContactItemData> = new Map();
	private searchTerm = '';
	private currentUserLogin: string | null = null;
	// Храним текущие счетчики для сравнения
	private currentUnreadCounts: Map<string, number> = new Map();

	private unsubscribeFunctions: (() => void)[] = [];

	constructor(eventBus: EventBus, stateService: StateService) {
		super({ tag: 'aside', classes: classes['contacts'] });
		this.eventBus = eventBus;
		this.stateService = stateService;

		// Получаем начальные данные
		this.currentUserLogin =
			this.stateService.getCurrentUser()?.login ?? null;
		this.allUsers = this.getSortedUsers(this.stateService.getUsers());
		this.currentUnreadCounts = new Map(
			this.stateService.getStateSnapshot().unreadCounts,
		); // Начальные счетчики

		// Вызываем render ВРУЧНУЮ в конце конструктора
		this.render();
	}

	public destroy(): void {
		this.unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
		this.unsubscribeFunctions = [];
		super.destroy();
	}

	// Render создает структуру, добавляет слушатели, подписки и рендерит начальный список
	protected render(): void {
		console.log('ContactsComponent rendering...');
		// Создаем поиск и список
		this.searchInput = ElementCreator.create({
			tag: 'input',
			classes: classes['search-input'],
			attributes: { type: 'search', placeholder: 'Search contacts...' },
			on: { input: this.handleSearchInput.bind(this) },
		}) as HTMLInputElement;

		this.contactsListElement = ElementCreator.create({
			tag: 'ul',
			classes: classes['contacts-list'],
		}) as HTMLUListElement;

		// Добавляем в корневой элемент this.element
		this.appendChildren([this.searchInput, this.contactsListElement]);

		// Рендерим начальный список (после создания contactsListElement)
		this.renderFilteredList();
		// Подписываемся на события
		this.subscribeToEvents();
	}

	private subscribeToEvents(): void {
		// Обновление списка пользователей
		const unsubscribeUsers = this.eventBus.subscribe(
			'state:userListUpdated',
			(users: UserInfo[]) => {
				this.allUsers = this.getSortedUsers(users);
				this.renderFilteredList(); // Полная перерисовка при изменении списка
			},
		);
		this.unsubscribeFunctions.push(unsubscribeUsers);

		// Обновление текущего пользователя
		const unsubscribeCurrentUser = this.eventBus.subscribe(
			'state:currentUserChanged',
			(user) => {
				const previousLogin = this.currentUserLogin;
				this.currentUserLogin = user?.login ?? null;
				if (previousLogin !== this.currentUserLogin) {
					this.renderFilteredList(); // Полная перерисовка, т.к. себя нужно исключить
				}
			},
		);
		this.unsubscribeFunctions.push(unsubscribeCurrentUser);

		// *** Подписка на обновление счетчиков непрочитанных ***
		const unsubscribeUnread = this.eventBus.subscribe(
			'state:unreadCountsUpdated',
			(newCounts: Map<string, number>) => {
				console.log(
					'ContactsComponent: Received unread counts update',
					newCounts,
				);
				this.currentUnreadCounts = newCounts; // Обновляем локальную копию
				// Обновляем значки для всех видимых контактов
				this.renderedContactItems.forEach((itemData, userId) => {
					this.updateUnreadBadge(userId, newCounts.get(userId) ?? 0);
				});
			},
		);
		this.unsubscribeFunctions.push(unsubscribeUnread);
	}

	// Обработчик поиска
	private handleSearchInput(event: Event): void {
		const input = event.target as HTMLInputElement;
		this.searchTerm = input.value.trim().toLowerCase();
		this.renderFilteredList(); // Перерисовываем с фильтром
	}

	// Сортировка
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

	// Рендеринг списка (полная перерисовка)
	private renderFilteredList(): void {
		if (!this.contactsListElement) return;
		// console.log('ContactsComponent rendering filtered list...');

		const filteredUsers = this.allUsers.filter(
			(user) =>
				user.login !== this.currentUserLogin &&
				user.login.toLowerCase().includes(this.searchTerm),
		);

		// Очищаем перед перерисовкой
		this.contactsListElement.innerHTML = '';
		this.renderedContactItems.clear();
		const fragment = document.createDocumentFragment();

		filteredUsers.forEach((user) => {
			const contactElements = this.createContactItemElements(user); // Создаем li и badge
			fragment.append(contactElements.item); // Добавляем li во фрагмент
			this.renderedContactItems.set(user.login, {
				user,
				elements: contactElements,
			});
			// Сразу обновляем значок непрочитанных для только что созданного элемента
			this.updateUnreadBadge(
				user.login,
				this.currentUnreadCounts.get(user.login) ?? 0,
			);
		});

		this.contactsListElement.append(fragment); // Добавляем все элементы разом
	}

	// Создает элементы для одного контакта (li и span для badge)
	private createContactItemElements(user: UserInfo): ContactItemElements {
		const itemClasses = [
			classes['contacts-item'],
			user.isLogined
				? classes['contacts-item--online']
				: classes['contacts-item--offline'],
		];

		// Создаем элемент для счетчика непрочитанных
		const unreadBadge = ElementCreator.create({
			tag: 'span',
			classes: [classes['unread-badge'], classes['hidden']], // Сразу скрыт
			attributes: { 'aria-hidden': 'true' }, // Скрыть от скринридеров пока пуст
		}) as HTMLElement;

		// Создаем основной элемент li
		const contactItemElement = ElementCreator.create({
			tag: 'li',
			classes: itemClasses,
			attributes: { 'data-userid': user.login },
			on: { click: () => this.handleContactClick(user.login) },
			children: [
				// Добавляем имя пользователя и счетчик внутрь li
				ElementCreator.create({ tag: 'span', content: user.login }), // Имя в span для стилизации
				unreadBadge, // Добавляем пустой badge
			],
		}) as HTMLElement;

		return { item: contactItemElement, badge: unreadBadge };
	}

	// Обработчик клика по контакту
	private handleContactClick(userId: string): void {
		console.log(`Clicked on user: ${userId}`);
		this.eventBus.publish('ui:selectChat', { userId });
		// Можно добавить класс 'active' к выбранному элементу
		this.updateActiveClass(userId);
	}

	// Обновление класса активного элемента
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

	// Обновляет текст и видимость счетчика непрочитанных
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

			// Опционально: добавить класс к li, если есть непрочитанные
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

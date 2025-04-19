// src/services/state-service.ts
import type { EventBus } from './event-bus';
import type { ConnectionStatus } from './web-socket-service';
import type { AppState } from '../types/state';
import { getInitialAppState } from '../types/state';
import type { UserInfo, MessageData } from '../types/api-types';

export class StateService {
	private readonly eventBus: EventBus;
	private state: AppState = getInitialAppState();

	constructor(eventBus: EventBus) {
		this.eventBus = eventBus;
		this.subscribeToEvents(); // Подписываемся на события при инициализации
	}

	// --- Публичные Геттеры ---

	public getStateSnapshot(): Readonly<AppState> {
		// Возвращаем копию для предотвращения прямого изменения
		// Вложенные Map и массивы все еще изменяемы, нужна глубокая копия для полной иммутабельности
		// Но для простоты пока так. Readonly типизация помогает.
		return { ...this.state };
	}

	public getConnectionStatus(): ConnectionStatus {
		return this.state.connectionStatus;
	}

	public getCurrentUser(): UserInfo | null {
		return this.state.currentUser;
	}

	public getUsers(): UserInfo[] {
		// Возвращаем массив пользователей для удобства UI
		return [...this.state.users.values()];
	}

	public getUser(login: string): UserInfo | undefined {
		return this.state.users.get(login);
	}

	public getSelectedChatUserId(): string | null {
		return this.state.selectedChatUserId;
	}

	public getCurrentChatMessages(): Readonly<MessageData[]> {
		// Возвращаем Readonly массив
		return this.state.currentChatMessages;
	}

	public getUnreadCount(userId: string): number {
		return this.state.unreadCounts.get(userId) ?? 0;
	}

	public getTotalUnreadCount(): number {
		let total = 0;
		this.state.unreadCounts.forEach((count) => (total += count));
		return total;
	}

	// TODO: Метод для установки сообщений ТЕКУЩЕГО чата (будет вызван после загрузки)
	public setMessagesForCurrentChat(messages: MessageData[]): void {
		// Проверяем, что пользователь чата все еще выбран
		if (!this.state.selectedChatUserId) {
			console.warn('Attempted to set messages when no chat is selected.');
			return;
		}
		// Простая замена массива (можно добавить логику слияния/сортировки)
		// Убедимся, что сообщения отсортированы! Сервер обещает сортировку.
		this.state.currentChatMessages = [...messages]; // Копируем массив
		this.publishStateChange();
		this.eventBus.publish(
			'state:currentMessagesUpdated',
			this.state.currentChatMessages,
		);
	}

	// --- Подписка на внешние события ---

	private subscribeToEvents(): void {
		// Статус соединения от WebSocketService
		this.eventBus.subscribe('websocket:status', (status) => {
			this.setConnectionStatus(status);
		});

		// Аутентификация от AuthService
		this.eventBus.subscribe('auth:loginSuccess', (userInfo) => {
			this.setCurrentUser(userInfo);
			// Загрузка пользователей инициируется AuthService
		});
		this.eventBus.subscribe('auth:logoutSuccess', () => {
			this.resetStateOnLogout();
		});
		// Можно слушать 'auth:loginFailed' для сброса флагов загрузки, если нужно

		// Получение списка пользователей от AuthService (Вариант 1)
		this.eventBus.subscribe('data:userListReceived', (userList) => {
			this.setUsers(userList);
			// Можно сбросить флаг загрузки, если он используется
		});

		// Уведомления от сервера (от WebSocketService)
		this.eventBus.subscribe('server:userExternalLogin', (payload) => {
			this.updateUser(payload.user);
		});
		this.eventBus.subscribe('server:userExternalLogout', (payload) => {
			this.updateUser(payload.user);
		});
		this.eventBus.subscribe('server:messageReceived', (payload) => {
			this.handleNewMessage(payload.message);
		});
		this.eventBus.subscribe('server:messageDelivered', (payload) => {
			this.updateMessageStatus(payload.message.id, { isDelivered: true });
		});
		this.eventBus.subscribe('server:messageRead', (payload) => {
			this.updateMessageStatus(payload.message.id, { isReaded: true });
			// Если это наше сообщение прочитали, сбрасывать счетчик не нужно.
			// Сброс счетчика происходит, когда МЫ читаем сообщения ('ui:selectChat' или 'ui:markMessagesRead')
		});
		this.eventBus.subscribe('server:messageDeleted', (payload) => {
			this.deleteMessage(payload.message.id);
		});
		this.eventBus.subscribe('server:messageEdited', (payload) => {
			this.editMessage(payload.message.id, payload.message.text, {
				isEdited: true,
			});
		});

		// События от UI
		this.eventBus.subscribe('ui:selectChat', ({ userId }) => {
			this.setSelectedChatUserId(userId);
			console.log('>>> Selected chat:', userId);
			// TODO: Здесь нужно инициировать загрузку сообщений для этого чата!
			// Например, опубликовать событие 'data:requestMessages' или вызвать MessageService.
			// Пока просто сбросим счетчик непрочитанных для выбранного чата.
			this.resetUnreadCount(userId);
		});
		this.eventBus.subscribe('ui:clearChatSelection', () => {
			this.setSelectedChatUserId(null);
		});
		// Можно добавить подписку на 'ui:sendMessage' и т.д., если StateService
		// должен реагировать на них (например, для оптимистичного обновления UI)
	}

	// --- Приватные Мутаторы Состояния (обновляют state и публикуют события) ---

	private setConnectionStatus(status: ConnectionStatus): void {
		if (this.state.connectionStatus !== status) {
			this.state.connectionStatus = status;
			this.publishStateChange();
			this.eventBus.publish('state:connectionStatusChanged', status);
		}
	}

	private setCurrentUser(user: UserInfo | null): void {
		if (this.state.currentUser?.login !== user?.login) {
			this.state.currentUser = user;
			this.publishStateChange();
			this.eventBus.publish('state:currentUserChanged', user);
		}
	}

	private setUsers(users: UserInfo[]): void {
		const newUsersMap = new Map<string, UserInfo>();
		users.forEach((user) => newUsersMap.set(user.login, user));
		this.state.users = newUsersMap;
		this.publishStateChange();
		// Публикуем массив для UI
		this.eventBus.publish('state:userListUpdated', this.getUsers());
	}

	// Обновляет или добавляет пользователя в Map
	private updateUser(user: UserInfo): void {
		const userExists = this.state.users.has(user.login);
		const currentUserStatus = this.state.users.get(user.login)?.isLogined;
		// Обновляем только если пользователь новый или статус изменился
		if (!userExists || currentUserStatus !== user.isLogined) {
			this.state.users.set(user.login, user);
			this.publishStateChange();
			// Публикуем обновленный массив
			this.eventBus.publish('state:userListUpdated', this.getUsers());
		}
	}

	private setSelectedChatUserId(userId: string | null): void {
		if (this.state.selectedChatUserId !== userId) {
			this.state.selectedChatUserId = userId;
			this.state.currentChatMessages = []; // Очищаем сообщения при смене чата
			this.publishStateChange();
			this.eventBus.publish('state:selectedChatChanged', userId);
			this.eventBus.publish('state:currentMessagesUpdated', []); // Публикуем пустой массив
			// Сброс счетчика для нового выбранного чата (если он есть)
			if (userId) {
				this.resetUnreadCount(userId);
			}
		}
	}

	// Обработка нового входящего или исходящего (после ответа сервера) сообщения
	private handleNewMessage(message: MessageData): void {
		const currentUserLogin = this.state.currentUser?.login;
		if (!currentUserLogin) return; // Не обрабатываем, если не авторизованы

		const isOutgoing = message.from === currentUserLogin;
		const chatPartnerLogin = isOutgoing ? message.to : message.from;

		// Добавляем сообщение в текущий чат, если он выбран
		if (this.state.selectedChatUserId === chatPartnerLogin) {
			// Проверяем, нет ли уже такого сообщения (на всякий случай)
			if (
				!this.state.currentChatMessages.some((m) => m.id === message.id)
			) {
				this.state.currentChatMessages.push(message);
				// Сортируем по времени, если порядок не гарантирован
				this.state.currentChatMessages.sort(
					(a, b) => a.datetime - b.datetime,
				);
				this.publishStateChange();
				this.eventBus.publish('state:currentMessagesUpdated', [
					...this.state.currentChatMessages,
				]); // Отправляем копию
			}
		} else if (!isOutgoing) {
			// Если сообщение входящее и чат НЕ выбран, увеличиваем счетчик непрочитанных
			this.incrementUnreadCount(chatPartnerLogin);
		}
	}

	// Обновляет статус существующего сообщения в текущем чате
	private updateMessageStatus(
		messageId: string,
		statusUpdate: Partial<MessageData['status']>,
	): void {
		const messageIndex = this.state.currentChatMessages.findIndex(
			(m) => m.id === messageId,
		);
		if (messageIndex !== -1) {
			const updatedMessage = {
				...this.state.currentChatMessages[messageIndex],
				status: {
					...this.state.currentChatMessages[messageIndex].status,
					...statusUpdate, // Применяем частичное обновление статуса
				},
			};
			this.state.currentChatMessages[messageIndex] = updatedMessage;
			this.publishStateChange();
			this.eventBus.publish('state:currentMessagesUpdated', [
				...this.state.currentChatMessages,
			]);
		}
		// Если сообщение не в текущем чате, его статус обновится при загрузке этого чата
	}

	// Удаляет сообщение из текущего чата
	private deleteMessage(messageId: string): void {
		const initialLength = this.state.currentChatMessages.length;
		this.state.currentChatMessages = this.state.currentChatMessages.filter(
			(m) => m.id !== messageId,
		);
		if (this.state.currentChatMessages.length !== initialLength) {
			this.publishStateChange();
			this.eventBus.publish('state:currentMessagesUpdated', [
				...this.state.currentChatMessages,
			]);
		}
	}

	// Редактирует текст и статус сообщения в текущем чате
	private editMessage(
		messageId: string,
		newText: string,
		statusUpdate: Partial<MessageData['status']>,
	): void {
		const messageIndex = this.state.currentChatMessages.findIndex(
			(m) => m.id === messageId,
		);
		if (messageIndex !== -1) {
			const updatedMessage = {
				...this.state.currentChatMessages[messageIndex],
				text: newText, // Обновляем текст
				status: {
					...this.state.currentChatMessages[messageIndex].status,
					...statusUpdate, // Обновляем статус (isEdited: true)
				},
			};
			this.state.currentChatMessages[messageIndex] = updatedMessage;
			this.publishStateChange();
			this.eventBus.publish('state:currentMessagesUpdated', [
				...this.state.currentChatMessages,
			]);
		}
	}

	private incrementUnreadCount(userId: string): void {
		const currentCount = this.state.unreadCounts.get(userId) ?? 0;
		this.state.unreadCounts.set(userId, currentCount + 1);
		this.publishStateChange();
		this.eventBus.publish(
			'state:unreadCountsUpdated',
			new Map(this.state.unreadCounts),
		); // Отправляем копию Map
	}

	private resetUnreadCount(userId: string): void {
		if (this.state.unreadCounts.has(userId)) {
			this.state.unreadCounts.delete(userId);
			this.publishStateChange();
			this.eventBus.publish(
				'state:unreadCountsUpdated',
				new Map(this.state.unreadCounts),
			);
		}
	}

	// Сброс состояния при выходе пользователя
	private resetStateOnLogout(): void {
		const initial = getInitialAppState();
		// Сохраняем статус соединения
		initial.connectionStatus = this.state.connectionStatus;
		this.state = initial;

		// Публикуем все изменения
		this.publishStateChange();
		this.eventBus.publish('state:currentUserChanged', null);
		this.eventBus.publish('state:userListUpdated', []);
		this.eventBus.publish('state:selectedChatChanged', null);
		this.eventBus.publish('state:currentMessagesUpdated', []);
		this.eventBus.publish('state:unreadCountsUpdated', new Map());
	}

	// Вспомогательный метод для публикации общего события изменения состояния (для дебага)
	private publishStateChange(): void {
		this.eventBus.publish('state:changed', this.getStateSnapshot());
	}
}

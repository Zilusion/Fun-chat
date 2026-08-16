import type { MessageService } from './message-service';
import type { EventBus } from './event-bus';
import type { ConnectionStatus } from './web-socket-service';
import type { AppState } from '../types/state';
import { getInitialAppState } from '../types/state';
import type { UserInfo, MessageData } from '../types/api-types';

export class StateService {
	private readonly eventBus: EventBus;
	private state: AppState = getInitialAppState();
	private messageService: MessageService;

	constructor(eventBus: EventBus, messageService: MessageService) {
		this.eventBus = eventBus;
		this.messageService = messageService;
		this.subscribeToEvents();
	}

	public getStateSnapshot(): Readonly<AppState> {
		return { ...this.state };
	}

	public getConnectionStatus(): ConnectionStatus {
		return this.state.connectionStatus;
	}

	public getCurrentUser(): UserInfo | null {
		return this.state.currentUser;
	}

	public getUsers(): UserInfo[] {
		return [...this.state.users.values()];
	}

	public getUser(login: string): UserInfo | undefined {
		return this.state.users.get(login);
	}

	public getSelectedChatUserId(): string | null {
		return this.state.selectedChatUserId;
	}

	public getCurrentChatMessages(): Readonly<MessageData[]> {
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

	public setMessagesForCurrentChat(messages: MessageData[]): void {
		if (!this.state.selectedChatUserId) {
			console.warn('Attempted to set messages when no chat is selected.');
			return;
		}
		this.state.currentChatMessages = [...messages];
		this.publishStateChange();
		this.eventBus.publish(
			'state:currentMessagesUpdated',
			this.state.currentChatMessages,
		);
	}

	public resetUnreadCount(userId: string): void {
		if (this.state.unreadCounts.has(userId)) {
			console.log(`StateService: Resetting unread count for ${userId}`);
			this.state.unreadCounts.delete(userId);
			this.publishStateChange();
			this.eventBus.publish(
				'state:unreadCountsUpdated',
				new Map(this.state.unreadCounts),
			);
		}
	}

	public resetStateOnLogout(): void {
		const initial = getInitialAppState();
		initial.connectionStatus = this.state.connectionStatus;
		this.state = initial;

		this.publishStateChange();
		this.eventBus.publish('state:currentUserChanged', null);
		this.eventBus.publish('state:userListUpdated', []);
		this.eventBus.publish('state:selectedChatChanged', null);
		this.eventBus.publish('state:currentMessagesUpdated', []);
		this.eventBus.publish('state:unreadCountsUpdated', new Map());
	}

	private subscribeToEvents(): void {
		this.eventBus.subscribe('websocket:status', (status) => {
			this.setConnectionStatus(status);
		});

		this.eventBus.subscribe(
			'data:initialUnreadCountsReceived',
			(initialCounts) => {
				console.log(
					'StateService: Received initial unread counts:',
					initialCounts,
				);
				if (this.state.currentUser) {
					const newUnreadCounts = new Map([
						...this.state.unreadCounts,
						...initialCounts,
					]);
					const validUnreadCounts = new Map<string, number>();
					newUnreadCounts.forEach((count, userId) => {
						if (this.state.users.has(userId)) {
							validUnreadCounts.set(userId, count);
						}
					});

					if (
						this.mapsAreEqual(
							this.state.unreadCounts,
							validUnreadCounts,
						)
					) {
						console.log(
							'StateService: Initial unread counts match current counts, no update needed.',
						);
						return;
					}

					this.state.unreadCounts = validUnreadCounts;
					this.publishStateChange();
					this.eventBus.publish(
						'state:unreadCountsUpdated',
						new Map(this.state.unreadCounts),
					);
				} else {
					console.warn(
						'StateService: Received initial unread counts, but user is no longer logged in.',
					);
				}
			},
		);

		this.eventBus.subscribe('websocket:close', ({ wasClean }) => {
			console.log('StateService: WebSocket closed.');
			if (wasClean) {
				console.log(
					'StateService: WebSocket closed cleanly (likely logout). State will be reset by auth:logoutSuccess.',
				);
			} else {
				console.log(
					'StateService: Connection lost unexpectedly. Resetting chat state...',
				);
				this.state.selectedChatUserId = null;
				this.state.currentChatMessages = [];
				this.state.unreadCounts.clear();
				this.publishStateChange();
				this.eventBus.publish('state:selectedChatChanged', null);
				this.eventBus.publish('state:currentMessagesUpdated', []);
				this.eventBus.publish('state:unreadCountsUpdated', new Map());
			}
		});

		this.eventBus.subscribe('auth:loginSuccess', (userInfo) => {
			this.setCurrentUser(userInfo);
		});
		this.eventBus.subscribe('auth:logoutSuccess', () => {
			this.resetStateOnLogout();
		});

		this.eventBus.subscribe('data:userListReceived', (userList) => {
			this.setUsers(userList);
		});

		this.eventBus.subscribe('server:userExternalLogin', (payload) => {
			const loggedInUserLogin = payload.user.login;
			console.log(
				`StateService: User ${loggedInUserLogin} logged in. Checking messages to mark as delivered.`,
			);
			this.updateUser(payload.user);
			this.markMessagesAsDeliveredToUser(loggedInUserLogin);
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
		});
		this.eventBus.subscribe('message:deletedSuccessfully', (payload) => {
			console.log(
				'StateService: Handling successfully deleted message:',
				payload.message.id,
			);
			this.deleteMessage(payload.message.id);
		});
		this.eventBus.subscribe('message:editedSuccessfully', (payload) => {
			console.log(
				'StateService: Handling successfully edited message:',
				payload.message.id,
			);
			this.editMessage(payload.message.id, payload.message.text, {
				isEdited: true,
			});
		});
		this.eventBus.subscribe('server:messageDeleted', (payload) => {
			this.deleteMessage(payload.message.id);
		});
		this.eventBus.subscribe('server:messageEdited', (payload) => {
			this.editMessage(payload.message.id, payload.message.text, {
				isEdited: true,
			});
		});
		this.eventBus.subscribe(
			'message:sentSuccessfully',
			(sentMessageData) => {
				console.log(
					'StateService: Handling successfully sent message:',
					sentMessageData.id,
				);
				this.handleNewMessage(sentMessageData);
			},
		);

		this.eventBus.subscribe('ui:selectChat', ({ userId }) => {
			this.setSelectedChatUserId(userId);
			console.log('>>> Selected chat:', userId);
		});
		this.eventBus.subscribe('ui:clearChatSelection', () => {
			this.setSelectedChatUserId(null);
		});
	}

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
		this.eventBus.publish('state:userListUpdated', this.getUsers());
	}

	private updateUser(user: UserInfo): void {
		const userExists = this.state.users.has(user.login);
		const currentUserStatus = this.state.users.get(user.login)?.isLogined;
		if (!userExists || currentUserStatus !== user.isLogined) {
			this.state.users.set(user.login, user);
			this.publishStateChange();
			this.eventBus.publish('state:userListUpdated', this.getUsers());
		}
	}

	private setSelectedChatUserId(userId: string | null): void {
		if (this.state.selectedChatUserId !== userId) {
			this.state.selectedChatUserId = userId;
			this.state.currentChatMessages = [];
			this.publishStateChange();
			this.eventBus.publish('state:selectedChatChanged', userId);
			this.eventBus.publish('state:currentMessagesUpdated', []);
		}
	}

	// src/services/state-service.ts

	private handleNewMessage(message: MessageData): void {
		const currentUserLogin = this.state.currentUser?.login;
		if (!currentUserLogin) return; // Выходим, если текущий пользователь не определен

		const isOutgoing = message.from === currentUserLogin; // Определяем, исходящее ли сообщение
		const chatPartnerLogin = isOutgoing ? message.to : message.from; // Определяем логин собеседника

		// --- Обработка сообщения для АКТИВНОГО чата ---
		if (this.state.selectedChatUserId === chatPartnerLogin) {
			console.log(
				`StateService: Handling message ${message.id} for active chat with ${chatPartnerLogin}`,
			);

			// Определяем, считался ли чат "прочитанным" пользователем ДО прихода этого сообщения.
			// Чат считается прочитанным, если для этого партнера НЕТ счетчика непрочитанных.
			const chatWasAlreadyReadByAction =
				!this.state.unreadCounts.has(chatPartnerLogin);

			// Создаем копию сообщения, чтобы не мутировать оригинал напрямую до добавления в стейт
			const messageCopy = { ...message, status: { ...message.status } };

			// Флаг, нужно ли публиковать обновление state:currentMessagesUpdated
			let messageNeedsUpdate = false;

			// --- Логика пометки Read и Инкремента Счетчика для АКТИВНОГО чата ---
			if (!isOutgoing) {
				// Если сообщение ВХОДЯЩЕЕ
				const chatPartner = this.state.users.get(chatPartnerLogin);
				const isPartnerOnline = chatPartner?.isLogined ?? false;

				// Проверяем, прочитано ли сообщение УЖЕ (например, пришло с isReaded:true от сервера)
				if (messageCopy.status.isReaded) {
					// Если сообщение пришло уже с isReaded: true, ничего не делаем со статусом/счетчиком
					console.log(
						`StateService: Incoming message ${messageCopy.id} is already marked as read.`,
					);
				} else {
					// Сообщение еще не прочитано
					if (isPartnerOnline && chatWasAlreadyReadByAction) {
						// Сценарий 1: Собеседник онлайн И чат УЖЕ СЧИТАЛСЯ прочитанным -> Немедленно помечаем Read
						console.log(
							`StateService: Incoming message ${messageCopy.id} in active AND already read chat. Marking as read.`,
						);
						// 1. Оптимистично обновляем статус в КОПИИ сообщения
						messageCopy.status.isReaded = true;
						messageNeedsUpdate = true; // Точно нужно обновить UI
						// 2. Отправляем MSG_READ на сервер
						void this.messageService
							.markMessageAsRead(messageCopy.id)
							.catch((error) =>
								console.error(
									`StateService: Failed to send MSG_READ for ${messageCopy.id}`,
									error,
								),
							);
						// 3. Сбрасывать счетчик не нужно, его и так не было
					} else {
						// Сценарий 2: Чат ЕЩЕ НЕ прочитан пользователем ИЛИ собеседник оффлайн -> Увеличиваем счетчик
						console.log(
							`StateService: Incoming message ${messageCopy.id} in active BUT UNREAD chat. Incrementing count.`,
						);
						this.incrementUnreadCount(chatPartnerLogin); // <--- УВЕЛИЧИВАЕМ СЧЕТЧИК ЗДЕСЬ
						// НЕ отправляем MSG_READ - ждем действия пользователя
						// messageNeedsUpdate будет true при добавлении сообщения ниже
					}
				}
			}
			// --- Конец логики ---

			// --- Добавляем/Обновляем сообщение в массиве ---
			const existingIndex = this.state.currentChatMessages.findIndex(
				(m) => m.id === messageCopy.id,
			);
			if (existingIndex === -1) {
				// Сообщения нет - добавляем (уже с возможно обновленным isReaded)
				this.state.currentChatMessages.push(messageCopy);
				this.state.currentChatMessages.sort(
					(a, b) => a.datetime - b.datetime,
				);
				messageNeedsUpdate = true; // Новое сообщение - точно обновляем
				console.log(
					`StateService: Added new message ${messageCopy.id} to active chat.`,
				);
			} else {
				// Сообщение есть - обновляем, если есть разница (включая наш возможный апдейт isReaded)
				const existingMessage =
					this.state.currentChatMessages[existingIndex];
				if (
					JSON.stringify(existingMessage) !==
					JSON.stringify(messageCopy)
				) {
					this.state.currentChatMessages[existingIndex] = messageCopy;
					messageNeedsUpdate = true; // Обновили - нужно публиковать
					console.warn(
						`StateService: Message ${messageCopy.id} already exists. Updating with new data.`,
					);
				}
			}
			// -----------------------------------------

			// Публикуем обновление, если сообщение было добавлено или обновлено
			if (messageNeedsUpdate) {
				this.publishStateChange();
				this.eventBus.publish('state:currentMessagesUpdated', [
					...this.state.currentChatMessages,
				]);
			}

			// --- Обработка сообщения для НЕактивного чата ---
		} else if (!isOutgoing) {
			// Это входящее сообщение для чата, который сейчас НЕ выбран пользователем
			const senderInfo = this.state.users.get(chatPartnerLogin);
			// Увеличиваем счетчик непрочитанных, если отправитель онлайн
			if (senderInfo?.isLogined) {
				console.log(
					`StateService: Incrementing unread count for online user ${chatPartnerLogin} (inactive chat)`,
				);
				this.incrementUnreadCount(chatPartnerLogin);
			} else {
				console.log(
					`StateService: Incoming message from offline user ${chatPartnerLogin} (inactive chat). Not incrementing unread count.`,
				);
			}
		}
	}

	// private handleNewMessage(message: MessageData): void {
	// 	const currentUserLogin = this.state.currentUser?.login;
	// 	if (!currentUserLogin) return;

	// 	const isOutgoing = message.from === currentUserLogin;
	// 	const chatPartnerLogin = isOutgoing ? message.to : message.from;

	// 	// Обрабатываем сообщение, если оно для активного чата
	// 	if (this.state.selectedChatUserId === chatPartnerLogin) {
	// 		console.log(
	// 			`StateService: Handling message ${message.id} for active chat with ${chatPartnerLogin}`,
	// 		);

	// 		// Определяем, считался ли чат "прочитанным" ДО прихода этого сообщения.
	// 		// Чат считается прочитанным, если для этого партнера НЕТ счетчика непрочитанных.
	// 		const chatWasAlreadyRead =
	// 			!this.state.unreadCounts.has(chatPartnerLogin);

	// 		// Создаем копию сообщения для возможной модификации
	// 		const messageCopy = { ...message, status: { ...message.status } };

	// 		// --- Логика немедленного прочтения ---
	// 		// Помечаем прочитанным ТОЛЬКО если:
	// 		// 1. Сообщение входящее
	// 		// 2. Собеседник онлайн
	// 		// 3. Сообщение еще не помечено как Read
	// 		// 4. Чат УЖЕ СЧИТАЛСЯ прочитанным (нет счетчика в unreadCounts)
	// 		const chatPartner = this.state.users.get(chatPartnerLogin);
	// 		const isPartnerOnline = chatPartner?.isLogined ?? false;

	// 		if (
	// 			!isOutgoing &&
	// 			isPartnerOnline &&
	// 			chatWasAlreadyRead &&
	// 			!messageCopy.status.isReaded
	// 		) {
	// 			console.log(
	// 				`StateService: Incoming message ${messageCopy.id} in active AND already read chat. Marking as read.`,
	// 			);
	// 			// 1. Оптимистично обновляем статус в КОПИИ сообщения
	// 			messageCopy.status.isReaded = true;
	// 			// 2. Отправляем MSG_READ на сервер
	// 			void this.messageService
	// 				.markMessageAsRead(messageCopy.id)
	// 				.catch((error) =>
	// 					console.error(
	// 						`StateService: Failed to send MSG_READ for ${messageCopy.id}`,
	// 						error,
	// 					),
	// 				);
	// 			// 3. Сбрасывать счетчик не нужно, его и так не было
	// 		}
	// 		// --- Конец логики немедленного прочтения ---

	// 		// --- Добавляем/Обновляем сообщение в массиве ---
	// 		let messageNeedsUpdate = false;
	// 		const existingIndex = this.state.currentChatMessages.findIndex(
	// 			(m) => m.id === messageCopy.id,
	// 		);
	// 		if (existingIndex === -1) {
	// 			this.state.currentChatMessages.push(messageCopy); // Добавляем (возможно, уже с isReaded: true)
	// 			this.state.currentChatMessages.sort(
	// 				(a, b) => a.datetime - b.datetime,
	// 			);
	// 			messageNeedsUpdate = true;
	// 			console.log(
	// 				`StateService: Added new message ${messageCopy.id} to active chat.`,
	// 			);
	// 		} else {
	// 			const existingMessage =
	// 				this.state.currentChatMessages[existingIndex];
	// 			if (
	// 				JSON.stringify(existingMessage) !==
	// 				JSON.stringify(messageCopy)
	// 			) {
	// 				// Сравниваем с messageCopy
	// 				this.state.currentChatMessages[existingIndex] = messageCopy; // Обновляем
	// 				messageNeedsUpdate = true;
	// 				console.warn(
	// 					`StateService: Message ${messageCopy.id} already exists. Updating with new data.`,
	// 				);
	// 			}
	// 		}
	// 		// -----------------------------------------

	// 		// Публикуем обновление, если нужно
	// 		if (messageNeedsUpdate) {
	// 			this.publishStateChange();
	// 			this.eventBus.publish('state:currentMessagesUpdated', [
	// 				...this.state.currentChatMessages,
	// 			]);
	// 		}
	// 	} else if (!isOutgoing) {
	// 		// Входящее для неактивного чата
	// 		const senderInfo = this.state.users.get(chatPartnerLogin);
	// 		if (senderInfo?.isLogined) {
	// 			// Увеличиваем счетчик только если отправитель онлайн
	// 			this.incrementUnreadCount(chatPartnerLogin);
	// 		}
	// 	}
	// }

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
					...statusUpdate,
				},
			};
			this.state.currentChatMessages[messageIndex] = updatedMessage;
			this.publishStateChange();
			this.eventBus.publish('state:currentMessagesUpdated', [
				...this.state.currentChatMessages,
			]);
		}
	}

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
				text: newText,
				status: {
					...this.state.currentChatMessages[messageIndex].status,
					...statusUpdate,
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
		);
	}

	private mapsAreEqual(
		map1: Map<string, number>,
		map2: Map<string, number>,
	): boolean {
		if (map1.size !== map2.size) {
			return false;
		}
		for (const [key, value] of map1) {
			if (!map2.has(key) || map2.get(key) !== value) {
				return false;
			}
		}
		return true;
	}

	private publishStateChange(): void {
		this.eventBus.publish('state:changed', this.getStateSnapshot());
	}

	private markMessagesAsDeliveredToUser(recipientLogin: string): void {
		const currentUserLogin = this.state.currentUser?.login;
		if (
			currentUserLogin &&
			this.state.selectedChatUserId === recipientLogin
		) {
			let changed = false;
			this.state.currentChatMessages = this.state.currentChatMessages.map(
				(message) => {
					if (
						message.from === currentUserLogin &&
						message.to === recipientLogin &&
						!message.status.isDelivered
					) {
						changed = true;
						return {
							...message,
							status: { ...message.status, isDelivered: true },
						};
					}
					return message;
				},
			);

			if (changed) {
				console.log(
					`StateService: Marked some messages to ${recipientLogin} as delivered in current chat.`,
				);
				this.publishStateChange();
				this.eventBus.publish('state:currentMessagesUpdated', [
					...this.state.currentChatMessages,
				]);
			}
		} else {
			console.log(
				`StateService: User ${recipientLogin} logged in, but chat is not active. Statuses will update on fetch.`,
			);
		}
	}
}

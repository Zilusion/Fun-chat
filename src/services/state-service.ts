import type { EventBus } from './event-bus';
import type { ConnectionStatus } from './web-socket-service';
import type { AppState } from '../types/state';
import { getInitialAppState } from '../types/state';
import type { UserInfo, MessageData } from '../types/api-types';
import type { MessageService } from './message-service';

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
			this.resetUnreadCount(userId);
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
			if (userId) {
				this.resetUnreadCount(userId);
			}
		}
	}

	private handleNewMessage(message: MessageData): void {
		const currentUserLogin = this.state.currentUser?.login;
		if (!currentUserLogin) return;

		const isOutgoing = message.from === currentUserLogin;
		const chatPartnerLogin = isOutgoing ? message.to : message.from;

		if (this.state.selectedChatUserId === chatPartnerLogin) {
			let messageNeedsUpdate = false;
			const existingIndex = this.state.currentChatMessages.findIndex(
				(m) => m.id === message.id,
			);

			if (existingIndex === -1) {
				this.state.currentChatMessages.push(message);
				this.state.currentChatMessages.sort(
					(a, b) => a.datetime - b.datetime,
				);
				messageNeedsUpdate = true;
			} else {
				this.state.currentChatMessages[existingIndex] = message;
				messageNeedsUpdate = true;
				console.warn(
					`StateService: Message ${message.id} already exists. Updating.`,
				);
			}

			if (!isOutgoing) {
				const currentMessageInState =
					this.state.currentChatMessages.find(
						(m) => m.id === message.id,
					);
				if (
					currentMessageInState &&
					!currentMessageInState.status.isReaded
				) {
					console.log(
						`StateService: Incoming message ${message.id} for active chat. Optimistically marking as read and sending MSG_READ.`,
					);
					currentMessageInState.status.isReaded = true;
					messageNeedsUpdate = true;

					void this.messageService
						.markMessageAsRead(message.id)
						.catch((error) =>
							console.error(
								`StateService: Failed to send MSG_READ for ${message.id}`,
								error,
							),
						);

					this.resetUnreadCount(chatPartnerLogin);
				}
			}

			if (messageNeedsUpdate) {
				this.publishStateChange();
				this.eventBus.publish('state:currentMessagesUpdated', [
					...this.state.currentChatMessages,
				]);
			}
		} else if (!isOutgoing) {
			this.incrementUnreadCount(chatPartnerLogin);
		}
	}

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

// src/components/chat-area/chat-area-component.ts
import type { EventBus } from '../../services/event-bus';
import type { StateService } from '../../services/state-service';
import type { MessageService } from '../../services/message-service';
import type { UserInfo, MessageData } from '../../types/api-types';
import ElementCreator from '../../utils/element-creator';
import { BaseComponent } from '../base/component';
import { ChatMessageComponent } from './chat-message-component';

import classes from './_chat-area-component.module.scss';

export class ChatAreaComponent extends BaseComponent<HTMLElement> {
	private readonly eventBus: EventBus;
	private readonly stateService: StateService;
	private readonly messageService: MessageService;

	private currentChatPartner: UserInfo | null = null;
	private messages: MessageData[] = [];
	private isLoading = false;
	private firstUnreadMessageId: string | null = null;
	private unreadDividerElement: HTMLElement | null = null;
	private shouldShowUnreadDivider = false;
	private readActionTriggered = false;
	private ignoreNextScrollEvent = false;

	private chatHeader!: HTMLElement;
	private partnerNameElement!: HTMLElement;
	private partnerStatusElement!: HTMLElement;
	private messageListElement!: HTMLElement;
	private chatFooter!: HTMLElement;
	private messageInput!: HTMLTextAreaElement;
	private sendButton!: HTMLButtonElement;
	private placeholderElement!: HTMLElement;

	private messageComponents: Map<string, ChatMessageComponent> = new Map();

	private unsubscribeFunctions: (() => void)[] = [];

	constructor(
		eventBus: EventBus,
		stateService: StateService,
		messageService: MessageService,
	) {
		super({
			tag: 'section',
			classes: classes['chat-area'],
		});

		this.eventBus = eventBus;
		this.stateService = stateService;
		this.messageService = messageService;

		this.render();
	}

	public destroy(): void {
		this.unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
		this.unsubscribeFunctions = [];
		this.messageListElement?.removeEventListener(
			'scroll',
			this.handleScroll.bind(this),
		);
		this.messageListElement?.removeEventListener(
			'click',
			this.handleMessagesClick.bind(this),
		);
		this.sendButton?.removeEventListener(
			'click',
			this.handleSendClick.bind(this),
		);
		this.messageInput?.removeEventListener(
			'keydown',
			this.handleInputKeyDown.bind(this),
		);
		this.messageInput?.removeEventListener(
			'input',
			this.autoResizeInput.bind(this),
		);
		this.messageComponents.forEach((comp) => comp.destroy());
		this.messageComponents.clear();
		super.destroy();
	}

	protected render(): void {
		console.log('ChatAreaComponent rendering...');
		this.chatHeader = ElementCreator.create({
			tag: 'header',
			classes: classes['chat-header'],
		}) as HTMLElement;
		this.partnerNameElement = ElementCreator.create({
			tag: 'span',
			classes: classes['partner-name'],
		}) as HTMLElement;
		this.partnerStatusElement = ElementCreator.create({
			tag: 'span',
			classes: classes['partner-status'],
		}) as HTMLElement;
		this.chatHeader.append(
			this.partnerNameElement,
			this.partnerStatusElement,
		);

		this.messageListElement = ElementCreator.create({
			tag: 'div',
			classes: classes['message-list'],
		}) as HTMLElement;
		this.placeholderElement = ElementCreator.create({
			tag: 'div',
			classes: classes['placeholder'],
		}) as HTMLElement;

		this.chatFooter = ElementCreator.create({
			tag: 'footer',
			classes: classes['chat-footer'],
		}) as HTMLElement;
		this.messageInput = ElementCreator.create({
			tag: 'textarea',
			classes: classes['message-input'],
			attributes: { placeholder: 'Your message...', rows: '1' },
		}) as HTMLTextAreaElement;
		this.sendButton = ElementCreator.create({
			tag: 'button',
			classes: ['button', classes['send-button']],
			content: 'Send',
			attributes: { type: 'button' },
		}) as HTMLButtonElement;
		this.chatFooter.append(this.messageInput, this.sendButton);

		this.appendChildren([
			this.chatHeader,
			this.messageListElement,
			this.placeholderElement,
			this.chatFooter,
		]);

		this.addEventListeners();
		this.subscribeToEvents();

		const initialSelectedUserId = this.stateService.getSelectedChatUserId();
		this.updateChatView(null);
		if (initialSelectedUserId) {
			const user = this.stateService.getUser(initialSelectedUserId);
			if (user) {
				this.updateChatView(user);
				this.loadMessages(initialSelectedUserId);
			}
		}
	}

	private addEventListeners(): void {
		this.sendButton.addEventListener(
			'click',
			this.handleSendClick.bind(this),
		);
		this.messageInput.addEventListener(
			'keydown',
			this.handleInputKeyDown.bind(this),
		);
		this.messageInput.addEventListener(
			'input',
			this.autoResizeInput.bind(this),
		);
		this.messageListElement.addEventListener(
			'scroll',
			this.handleScroll.bind(this),
			{ passive: true },
		);
		this.messageListElement.addEventListener(
			'click',
			this.handleMessagesClick.bind(this),
		);
	}

	private subscribeToEvents(): void {
		this.unsubscribeFunctions = [];
		const unsubscribeSelect = this.eventBus.subscribe(
			'state:selectedChatChanged',
			(userId) => {
				this.handleChatSelection(userId);
			},
		);
		this.unsubscribeFunctions.push(unsubscribeSelect);

		const unsubscribeChatRead = this.eventBus.subscribe(
			'chat:markedAsRead',
			({ userId }) => {
				// Если событие пришло для ТЕКУЩЕГО чата
				if (this.currentChatPartner?.login === userId) {
					console.log(
						`ChatArea: Received chat:markedAsRead for ${userId}. Setting readActionTriggered.`,
					);
					this.readActionTriggered = true; // Ставим флаг, что действие прочтения было
					// Сразу убираем разделитель, если он вдруг еще есть
					if (this.unreadDividerElement) {
						this.unreadDividerElement.remove();
						this.unreadDividerElement = null;
					}
					this.shouldShowUnreadDivider = false; // Запрещаем показ до смены чата
					this.firstUnreadMessageId = null;
				}
			},
		);
		this.unsubscribeFunctions.push(unsubscribeChatRead);

		const unsubscribeMessages = this.eventBus.subscribe(
			'state:currentMessagesUpdated',
			(newMessages: MessageData[]) => {
				if (this.currentChatPartner) {
					console.log(
						"ChatArea: Received 'state:currentMessagesUpdated'",
					);
					const wasScrolledToBottom = this.isScrolledToBottom();
					const isNewIncomingAdded =
						newMessages.length > this.messages.length &&
						newMessages.at(-1)?.from ===
							this.currentChatPartner.login;

					this.messages = newMessages;
					this.renderMessages(
						wasScrolledToBottom,
						isNewIncomingAdded,
					);
				}
			},
		);
		this.unsubscribeFunctions.push(unsubscribeMessages);

		const unsubscribeUsers = this.eventBus.subscribe(
			'state:userListUpdated',
			() => {
				if (this.currentChatPartner) {
					const updatedPartner = this.stateService.getUser(
						this.currentChatPartner.login,
					);
					if (
						updatedPartner &&
						updatedPartner.isLogined !==
							this.currentChatPartner.isLogined
					) {
						this.updateChatHeader(updatedPartner);
						this.currentChatPartner = updatedPartner;
					}
				}
			},
		);
		this.unsubscribeFunctions.push(unsubscribeUsers);

		const unsubscribeDelivered = this.eventBus.subscribe(
			'server:messageDelivered',
			(payload) => {
				const component = this.messageComponents.get(
					payload.message.id,
				);
				const messageData = this.findMessageById(payload.message.id);
				if (component && messageData) {
					messageData.status.isDelivered = true;
					component.updateMessage(messageData);
				}
			},
		);
		this.unsubscribeFunctions.push(unsubscribeDelivered);

		const unsubscribeRead = this.eventBus.subscribe(
			'server:messageRead',
			(payload) => {
				const component = this.messageComponents.get(
					payload.message.id,
				);
				const messageData = this.findMessageById(payload.message.id);
				if (component && messageData) {
					messageData.status.isReaded = true;
					component.updateMessage(messageData);
				}
			},
		);
		this.unsubscribeFunctions.push(unsubscribeRead);
	}

	private findMessageById(id: string): MessageData | undefined {
		return this.messages.find((m) => m.id === id);
	}

	private handleChatSelection(userId: string | null): void {
		console.log(`ChatArea: Handling chat selection for ${userId}`);
		this.firstUnreadMessageId = null;
		this.unreadDividerElement?.remove();
		this.unreadDividerElement = null;
		this.shouldShowUnreadDivider = true;
		this.readActionTriggered = false;
		this.ignoreNextScrollEvent = false;

		if (userId) {
			const user = this.stateService.getUser(userId);
			if (user) {
				this.updateChatView(user);
				this.loadMessages(userId);
			} else {
				console.error(
					`ChatArea: User info not found for ${userId} on selection`,
				);
				this.updateChatView(null);
			}
		} else {
			this.updateChatView(null);
		}
	}

	private loadMessages(userId: string): void {
		if (this.isLoading) {
			console.log('ChatArea: Message loading already in progress.');
			return;
		}
		this.isLoading = true;
		this.showLoadingState(true);
		this.messages = [];

		console.log(`ChatArea: Loading messages for ${userId}...`);
		void (async (): Promise<void> => {
			let fetchedMessages: MessageData[] | null = null;
			let fetchError: Error | null = null;

			try {
				fetchedMessages =
					await this.messageService.fetchMessages(userId);
				console.log(
					`ChatArea: Fetched ${fetchedMessages.length} messages for ${userId}`,
				);
			} catch (error) {
				console.error(
					`ChatArea: Failed to load messages for ${userId}:`,
					error,
				);
				fetchError =
					error instanceof Error ? error : new Error(String(error));
			} finally {
				this.isLoading = false;

				if (this.stateService.getSelectedChatUserId() === userId) {
					this.showLoadingState(false);

					if (fetchedMessages === null) {
						this.showPlaceholder(
							`Failed to load messages: ${fetchError?.message ?? 'Unknown error'}`,
						);
						this.messages = [];
						if (this.messageListElement)
							this.messageListElement.innerHTML = '';
						this.messageComponents.clear();
					} else {
						this.stateService.setMessagesForCurrentChat(
							fetchedMessages,
						);
					}
				} else {
					console.log(
						'ChatArea: Load finished, but chat changed. Discarding results.',
					);
				}
			}
		})();
	}

	private updateDisplayAfterLoading(): void {
		if (this.messages.length === 0 && this.currentChatPartner) {
			this.showPlaceholder(
				`This is the beginning of your conversation with ${this.currentChatPartner.login}`,
			);
		} else if (this.messages.length > 0) {
			this.hidePlaceholder();
		} else if (!this.currentChatPartner) {
			this.showPlaceholder('Select a chat to start messaging');
		}
	}

	// Обновляет вид чата
	private updateChatView(partner: UserInfo | null): void {
		this.currentChatPartner = partner;
		const isChatSelected = Boolean(partner);

		this.chatHeader.classList.toggle(
			classes['hidden'] ?? 'hidden',
			!isChatSelected,
		);
		this.chatFooter.classList.toggle(
			classes['hidden'] ?? 'hidden',
			!isChatSelected,
		);
		this.messageInput.disabled = !isChatSelected;
		this.sendButton.disabled = !isChatSelected;

		if (isChatSelected) {
			this.updateChatHeader(partner!);
			this.messages = [];
			this.renderMessages();
		} else {
			this.messages = [];
			this.messageListElement.innerHTML = '';
			this.messageComponents.forEach((comp) => comp.destroy());
			this.messageComponents.clear();
			this.showPlaceholder('Select a chat to start messaging');
			if (this.messageInput) this.messageInput.value = '';
		}
		this.autoResizeInput();
	}

	private updateChatHeader(partner: UserInfo): void {
		this.partnerNameElement.textContent = partner.login;
		const onlineClass = classes['partner-status--online'];
		const offlineClass = classes['partner-status--offline'];
		if (this.partnerStatusElement && onlineClass && offlineClass) {
			this.partnerStatusElement.textContent = partner.isLogined
				? 'Online'
				: 'Offline';
			if (partner.isLogined) {
				this.partnerStatusElement.classList.add(onlineClass);
				this.partnerStatusElement.classList.remove(offlineClass);
			} else {
				this.partnerStatusElement.classList.add(offlineClass);
				this.partnerStatusElement.classList.remove(onlineClass);
			}
		}
	}

	private showPlaceholder(text: string): void {
		this.placeholderElement.textContent = text;
		this.placeholderElement.classList.remove(classes['hidden'] ?? 'hidden');
		this.messageListElement.classList.add(classes['hidden'] ?? 'hidden');
	}

	private hidePlaceholder(): void {
		this.placeholderElement.classList.add(classes['hidden'] ?? 'hidden');
		this.messageListElement.classList.remove(classes['hidden'] ?? 'hidden');
	}

	private renderMessages(
		wasScrolledToBottom = false,
		isNewIncomingAdded = false,
	): void {
		if (!this.messageListElement) return;
		console.log(
			`ChatArea: Rendering ${this.messages.length} messages. WasScrolledToBottom: ${wasScrolledToBottom}, NewIncoming: ${isNewIncomingAdded}`,
		);

		const currentScrollTop = this.messageListElement.scrollTop;

		const newMessageIds = new Set(this.messages.map((m) => m.id));
		this.messageComponents.forEach((component, messageId) => {
			if (!newMessageIds.has(messageId)) {
				component.destroy();
				component.getElement().remove();
				this.messageComponents.delete(messageId);
			}
		});

		this.determineFirstUnread();

		let dividerNeedsInsert = false;
		if (this.firstUnreadMessageId && !this.unreadDividerElement) {
			this.unreadDividerElement = this.createUnreadDividerElement();
			dividerNeedsInsert = true;
			console.log('ChatArea: Unread divider element created.');
		} else if (!this.firstUnreadMessageId && this.unreadDividerElement) {
			this.unreadDividerElement.remove();
			this.unreadDividerElement = null;
			console.log('ChatArea: Unread divider element removed.');
		}

		const elementsToAppend: HTMLElement[] = [];
		let dividerInserted = false;
		if (this.unreadDividerElement && !dividerNeedsInsert) {
			elementsToAppend.push(this.unreadDividerElement);
			dividerInserted = true;
		}

		this.messages.forEach((message) => {
			if (
				this.unreadDividerElement &&
				message.id === this.firstUnreadMessageId &&
				!dividerInserted
			) {
				elementsToAppend.push(this.unreadDividerElement);
				dividerInserted = true;
			}
			const existingComponent = this.messageComponents.get(message.id);
			if (existingComponent) {
				existingComponent.updateMessage(message);
				elementsToAppend.push(existingComponent.getElement());
			} else {
				const messageComponent = new ChatMessageComponent({
					message,
					stateService: this.stateService,
					onDelete: this.handleDeleteMessage,
					onEdit: this.handleEditMessage,
				});
				this.messageComponents.set(message.id, messageComponent);
				elementsToAppend.push(messageComponent.getElement());
			}
		});
		this.messageListElement.replaceChildren(...elementsToAppend);

		if (this.firstUnreadMessageId && dividerInserted) {
			this.unreadDividerElement = this.messageListElement.querySelector(
				`.${classes['new-messages-divider']}`,
			);
		}

		if (this.messages.length > 0) {
			this.hidePlaceholder();
		} else if (this.currentChatPartner && !this.isLoading) {
			this.showPlaceholder(
				`This is the beginning of your conversation with ${this.currentChatPartner.login}`,
			);
		} else if (!this.currentChatPartner) {
			this.showPlaceholder('Select a chat to start messaging');
		}

		if (this.messages.length > 0) {
			const dividerJustAppeared =
				this.firstUnreadMessageId &&
				this.unreadDividerElement &&
				dividerInserted;

			if (dividerJustAppeared) {
				console.log(
					'ChatArea: Divider appeared, setting ignoreNextScrollEvent flag before scrolling.',
				);
				this.ignoreNextScrollEvent = true;
				this.scrollOnOpen();
			} else if (isNewIncomingAdded) {
				console.log(
					'ChatArea: Scrolling down for new incoming message.',
				);
				if (this.ignoreNextScrollEvent) {
					console.log(
						'ChatArea: Ignoring programmatic scroll after divider appearance.',
					);
				} else {
					this.scrollToBottom('smooth');
				}
			} else if (wasScrolledToBottom) {
				console.log('ChatArea: Staying at bottom (auto scroll).');
				if (this.ignoreNextScrollEvent) {
					console.log(
						'ChatArea: Ignoring programmatic scroll after divider appearance.',
					);
				} else {
					this.scrollToBottom('auto');
				}
			} else {
				console.log(
					`ChatArea: Restoring scroll to ${currentScrollTop}`,
				);
				this.messageListElement.scrollTop = currentScrollTop;
				this.ignoreNextScrollEvent = false;
			}

			if (this.ignoreNextScrollEvent) {
				setTimeout(() => {
					this.ignoreNextScrollEvent = false;
				}, 100);
			}
		}
	}

	private determineFirstUnread(): void {
		// Добавлена проверка !this.readActionTriggered
		if (this.shouldShowUnreadDivider && !this.readActionTriggered) {
			const currentUserLogin = this.stateService.getCurrentUser()?.login;
			this.firstUnreadMessageId =
				this.messages.find(
					(message) =>
						message.from !== currentUserLogin &&
						!message.status.isReaded,
				)?.id ?? null;
			console.log(
				'ChatArea: Determined first unread message ID:',
				this.firstUnreadMessageId,
			);
		} else {
			// Если показывать не нужно ИЛИ действие прочтения уже было, сбрасываем ID
			this.firstUnreadMessageId = null;
			// Если разделитель еще есть в DOM, но показывать не нужно, удаляем
			if (this.unreadDividerElement) {
				this.unreadDividerElement.remove();
				this.unreadDividerElement = null;
				console.log(
					'ChatArea: Removed unread divider because it should not be shown.',
				);
			}
		}
	}

	private createUnreadDividerElement(): HTMLElement {
		return ElementCreator.create({
			tag: 'div',
			classes: classes['new-messages-divider'],
			content: 'New messages',
		}) as HTMLElement;
	}

	private removeUnreadDivider(): void {
		// Вызываем пометку прочитанными ТОЛЬКО если разделитель БЫЛ ВИДИМЫМ
		// и действие прочтения ЕЩЕ НЕ БЫЛО ВЫПОЛНЕНО
		if (
			this.unreadDividerElement &&
			this.shouldShowUnreadDivider &&
			!this.readActionTriggered
		) {
			console.log(
				'ChatArea: Removing unread divider due to interaction AND marking as read.',
			);
			this.unreadDividerElement.remove();
			this.unreadDividerElement = null;
			this.shouldShowUnreadDivider = false; // Запрещаем показ до смены чата
			this.markVisibleMessagesAsRead(); // Инициируем пометку как прочитанных
			// firstUnreadMessageId сбросится в markVisibleMessagesAsRead или следующем determineFirstUnread
		} else if (this.unreadDividerElement) {
			// Если разделитель просто есть, но shouldShowUnreadDivider уже false, просто убираем
			this.unreadDividerElement.remove();
			this.unreadDividerElement = null;
			this.firstUnreadMessageId = null;
		}
	}

	private scrollOnOpen(): void {
		requestAnimationFrame(() => {
			if (!this.messageListElement) return;
			if (this.unreadDividerElement) {
				const dividerTop = this.unreadDividerElement.offsetTop;
				const listHeight = this.messageListElement.clientHeight;
				const scrollTo = Math.max(0, dividerTop - listHeight / 5);
				this.messageListElement.scrollTo({
					top: scrollTo,
					behavior: 'auto',
				});
				console.log(`Scrolling to unread divider at ${scrollTo}px`);
			}
		});
	}

	private handleDeleteMessage = (messageId: string): void => {
		console.log(`ChatArea: Requesting delete for message ${messageId}`);
		const messageComponent = this.messageComponents.get(messageId);
		messageComponent?.addClass(
			classes['message-item--pending'] ?? 'message-item--pending',
		);

		void (async (): Promise<void> => {
			try {
				await this.messageService.deleteMessage(messageId);
				console.log(`ChatArea: Delete request sent for ${messageId}`);
			} catch (error) {
				console.error(
					`ChatArea: Failed to delete message ${messageId}:`,
					error,
				);
				messageComponent?.removeClass(
					classes['message-item--pending'] ?? 'message-item--pending',
				);
			}
		})();
	};

	private handleEditMessage = (
		messageId: string,
		currentText: string,
	): void => {
		console.log(`ChatArea: Requesting edit for message ${messageId}`);
		const newText = prompt('Enter new message text:', currentText);

		if (
			newText !== null &&
			newText.trim() &&
			newText.trim() !== currentText.trim()
		) {
			const textToSend = newText.trim();
			console.log(
				`ChatArea: Sending edit request for ${messageId} with text: ${textToSend}`,
			);

			const messageComponent = this.messageComponents.get(messageId);
			messageComponent?.addClass(
				classes['message-item--pending'] ?? 'message-item--pending',
			);

			void (async (): Promise<void> => {
				try {
					await this.messageService.editMessage(
						messageId,
						textToSend,
					);
					console.log(`ChatArea: Edit request sent for ${messageId}`);
				} catch (error) {
					console.error(
						`ChatArea: Failed to edit message ${messageId}:`,
						error,
					);
					alert(
						`Error editing message: ${error instanceof Error ? error.message : 'Unknown error'}`,
					);
				} finally {
					messageComponent?.removeClass(
						classes['message-item--pending'] ??
							'message-item--pending',
					);
				}
			})();
		} else if (newText === null) {
			console.log('ChatArea: Edit cancelled by user.');
		} else {
			console.log('ChatArea: Edit cancelled or text not changed.');
		}
	};

	private handleScroll(): void {
		if (this.ignoreNextScrollEvent) {
			console.log(
				'ChatArea: Ignoring first scroll event after programmatic scroll.',
			);
			this.ignoreNextScrollEvent = false;
			return;
		}
		this.removeUnreadDivider();
	}
	private handleMessagesClick(): void {
		this.removeUnreadDivider();
	}
	private handleSendClick(): void {
		this.removeUnreadDivider();
		this.sendMessage();
	}
	private handleInputKeyDown = (event: KeyboardEvent): void => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			this.removeUnreadDivider();
			this.sendMessage();
		}
	};

	private markVisibleMessagesAsRead(): void {
		// Выполняем только если действие еще не было триггернуто
		if (this.readActionTriggered || !this.currentChatPartner) return;
		console.log('ChatArea: Triggering mark as read action...');
		this.readActionTriggered = true; // Ставим флаг СРАЗУ

		const currentUserLogin = this.stateService.getCurrentUser()?.login;
		if (!currentUserLogin) return;

		// Ищем ID непрочитанных ВХОДЯЩИХ
		const unreadIncomingMessageIds = this.messages
			.filter(
				(message) =>
					message.from === this.currentChatPartner?.login &&
					!message.status.isReaded,
			)
			.map((message) => message.id);

		if (unreadIncomingMessageIds.length > 0) {
			console.log(
				`ChatArea: Marking ${unreadIncomingMessageIds.length} messages as read: [${unreadIncomingMessageIds.join(', ')}]`,
			);
			// Сбрасываем счетчик в StateService немедленно
			this.stateService.resetUnreadCount(this.currentChatPartner.login);
			// Отправляем запросы на сервер
			unreadIncomingMessageIds.forEach((id) => {
				void this.messageService
					.markMessageAsRead(id)
					.catch((error) =>
						console.error(
							`Failed to mark message ${id} as read:`,
							error,
						),
					);
			});
		} else {
			console.log(
				'ChatArea: No unread incoming messages found to mark as read.',
			);
		}
		// Сбрасываем ID первого непрочитанного после попытки отметки
		this.firstUnreadMessageId = null;
		// Если разделитель еще есть, удаляем его (на случай если markVisibleMessagesAsRead вызван не через removeUnreadDivider)
		if (this.unreadDividerElement) {
			this.unreadDividerElement.remove();
			this.unreadDividerElement = null;
		}
	}

	private sendMessage(): void {
		const text = this.messageInput.value.trim();
		const recipient = this.currentChatPartner;
		if (!text || !recipient) {
			if (!text && this.messageInput) {
				this.messageInput.classList.add(
					classes['message-input--error'] ?? '',
				);
				setTimeout(
					() =>
						this.messageInput?.classList.remove(
							classes['message-input--error'] ?? '',
						),
					500,
				);
			}
			return;
		}
		const originalButtonText = this.sendButton.textContent;
		this.messageInput.disabled = true;
		this.sendButton.disabled = true;
		this.sendButton.textContent = 'Sending...';
		this.sendButton.classList.add('button--loading');

		void (async (): Promise<void> => {
			try {
				await this.messageService.sendMessage(recipient.login, text);
				this.messageInput.value = '';
				this.autoResizeInput();
				this.scrollToBottom();
			} catch (error) {
				console.error('Failed to send message:', error);
				alert(
					`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
				);
			} finally {
				if (this.messageInput) this.messageInput.disabled = false;
				if (this.sendButton) {
					this.sendButton.disabled = false;
					this.sendButton.textContent = originalButtonText;
					this.sendButton.classList.remove('button--loading');
				}
				if (this.messageInput) this.messageInput.focus();
			}
		})();
	}

	private autoResizeInput(): void {
		if (!this.messageInput) return;
		this.messageInput.style.height = 'auto';
		const maxHeight = 150;
		const { scrollHeight } = this.messageInput;
		const newHeight = Math.min(scrollHeight, maxHeight);
		this.messageInput.style.height = `${newHeight}px`;
		this.messageInput.style.overflowY =
			scrollHeight > maxHeight ? 'auto' : 'hidden';
	}

	private scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
		if (this.messageListElement) {
			requestAnimationFrame(() => {
				if (this.messageListElement) {
					this.messageListElement.scrollTo({
						top: this.messageListElement.scrollHeight,
						behavior,
					});
				}
			});
		}
	}

	private isScrolledToBottom(): boolean {
		if (!this.messageListElement) return true;
		const threshold = 10;
		return (
			this.messageListElement.scrollHeight -
				this.messageListElement.scrollTop -
				this.messageListElement.clientHeight <=
			threshold
		);
	}

	private showLoadingState(isLoading: boolean): void {
		const loadingClass = classes['chat-area--loading'];

		if (loadingClass) {
			if (isLoading) {
				this.addClass(loadingClass);
				this.showPlaceholder('Loading messages...');
			} else {
				this.removeClass(loadingClass);
				this.updateDisplayAfterLoading();
			}
		} else {
			console.warn(
				"ChatAreaComponent: Loading CSS class 'chat-area--loading' not found in module!",
			);
			if (isLoading) {
				this.showPlaceholder('Loading messages...');
			} else {
				this.updateDisplayAfterLoading();
			}
		}
	}
}

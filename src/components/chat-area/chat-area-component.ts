// src/components/chat-area/chat-area-component.ts
import type { EventBus } from '../../services/event-bus';
import type { StateService } from '../../services/state-service';
import type { MessageService } from '../../services/message-service';
import type { UserInfo, MessageData } from '../../types/api-types';
import ElementCreator from '../../utils/element-creator';
import { BaseComponent } from '../base/component';
// import { ChatMessageComponent } from './chat-message-component'; // Позже можно вынести

import classes from './_chat-area-component.module.scss';

export class ChatAreaComponent extends BaseComponent {
	private readonly eventBus: EventBus;
	private readonly stateService: StateService;
	private readonly messageService: MessageService;

	// Состояние компонента
	private currentChatPartner: UserInfo | null = null;
	private messages: MessageData[] = []; // Локальная копия для рендера
	private isLoading = false;

	// Элементы UI (используем !, т.к. render их создаст до первого использования)
	private chatHeader!: HTMLElement;
	private partnerNameElement!: HTMLElement;
	private partnerStatusElement!: HTMLElement;
	private messageListElement!: HTMLElement;
	private chatFooter!: HTMLElement;
	private messageInput!: HTMLTextAreaElement;
	private sendButton!: HTMLButtonElement;
	private placeholderElement!: HTMLElement;

	private unsubscribeFunctions: (() => void)[] = [];

	constructor(
		eventBus: EventBus,
		stateService: StateService,
		messageService: MessageService,
	) {
		// 1. Создаем корневой <section>
		super({
			tag: 'section',
			classes: classes['chat-area'],
		});

		// 2. Присваиваем зависимости
		this.eventBus = eventBus;
		this.stateService = stateService;
		this.messageService = messageService;

		// 3. Вызываем render ВРУЧНУЮ в конце конструктора
		this.render();
	}

	public destroy(): void {
		this.unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
		this.unsubscribeFunctions = [];
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
		super.destroy();
	}

	// Render создает всю структуру, добавляет слушатели и подписки
	protected render(): void {
		console.log('ChatAreaComponent rendering...');
		// --- Создание DOM структуры ---
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

		// Добавляем созданные части в корневой элемент this.element
		this.appendChildren([
			this.chatHeader,
			this.messageListElement,
			this.placeholderElement,
			this.chatFooter,
		]);

		// --- Добавление слушателей ---
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

		// --- Подписка на события ---
		this.subscribeToEvents();

		// --- Установка начального вида ---
		const initialSelectedUserId = this.stateService.getSelectedChatUserId();
		if (initialSelectedUserId) {
			this.handleChatSelection(initialSelectedUserId);
		} else {
			this.updateChatView(null);
		}
	}

	private subscribeToEvents(): void {
		const unsubscribeSelect = this.eventBus.subscribe(
			'state:selectedChatChanged',
			(userId) => {
				this.handleChatSelection(userId);
			},
		);
		this.unsubscribeFunctions.push(unsubscribeSelect);

		const unsubscribeMessages = this.eventBus.subscribe(
			'state:currentMessagesUpdated',
			(messages) => {
				if (this.currentChatPartner) {
					this.messages = messages;
					this.renderMessages();
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
	}

	// Обработчик выбора чата
	private handleChatSelection(userId: string | null): void {
		console.log(`ChatArea: Handling chat selection for ${userId}`);
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

	// Загрузка сообщений
	private loadMessages(userId: string): void {
		if (this.isLoading) return;
		this.isLoading = true;
		this.showLoadingState(true);
		this.messages = []; // Очищаем старые

		console.log(`ChatArea: Loading messages for ${userId}`);
		void (async (): Promise<void> => {
			try {
				const messages =
					await this.messageService.fetchMessages(userId);
				console.log(
					`ChatArea: Fetched ${messages.length} messages for ${userId}`,
				);
				if (this.stateService.getSelectedChatUserId() === userId) {
					this.stateService.setMessagesForCurrentChat(messages);
				} else {
					console.log(
						'ChatArea: Chat changed during message load, ignoring fetched messages.',
					);
				}
			} catch (error) {
				console.error(
					`ChatArea: Failed to load messages for ${userId}:`,
					error,
				);
				if (this.stateService.getSelectedChatUserId() === userId) {
					this.showPlaceholder('Failed to load messages.');
					this.messages = [];
				}
			} finally {
				if (
					this.stateService.getSelectedChatUserId() === userId ||
					!this.stateService.getSelectedChatUserId()
				) {
					this.isLoading = false;
					this.showLoadingState(false);
				}
			}
		})();
	}

	// Обновляет вид чата в зависимости от выбранного партнера
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
			this.messages = [...this.stateService.getCurrentChatMessages()];
			this.renderMessages();
		} else {
			this.messages = [];
			this.messageListElement.innerHTML = '';
			this.showPlaceholder('Select a chat to start messaging');
			if (this.messageInput) this.messageInput.value = '';
		}
		this.autoResizeInput();
	}

	// Обновляет хедер чата
	private updateChatHeader(partner: UserInfo): void {
		if (this.partnerNameElement) {
			this.partnerNameElement.textContent = partner.login;
		}
		if (this.partnerStatusElement) {
			this.partnerStatusElement.textContent = partner.isLogined
				? 'Online'
				: 'Offline';

			const onlineClass = classes['partner-status--online'];
			const offlineClass = classes['partner-status--offline'];

			// Проверяем классы на всякий случай
			if (!onlineClass || !offlineClass) {
				console.error(
					'ChatAreaComponent: Status CSS classes not found in module!',
				);
				return; // Выходим, если классов нет
			}

			// Устанавливаем нужный класс и удаляем противоположный
			if (partner.isLogined) {
				this.partnerStatusElement.classList.add(onlineClass);
				this.partnerStatusElement.classList.remove(offlineClass);
			} else {
				this.partnerStatusElement.classList.add(offlineClass);
				this.partnerStatusElement.classList.remove(onlineClass);
			}
		}
	}

	// Показывает/скрывает плейсхолдер
	private showPlaceholder(text: string): void {
		this.placeholderElement.textContent = text;
		this.placeholderElement.classList.remove(classes['hidden'] ?? 'hidden');
		this.messageListElement.classList.add(classes['hidden'] ?? 'hidden');
	}

	private hidePlaceholder(): void {
		this.placeholderElement.classList.add(classes['hidden'] ?? 'hidden');
		this.messageListElement.classList.remove(classes['hidden'] ?? 'hidden');
	}

	// Рендерит сообщения
	private renderMessages(): void {
		if (this.messages.length === 0 && this.currentChatPartner) {
			this.showPlaceholder(
				`This is the beginning of your conversation with ${this.currentChatPartner.login}`,
			);
		} else if (this.messages.length > 0) {
			this.hidePlaceholder();
			// Сохраняем текущую позицию скролла, если нужно будет восстановить
			const shouldScrollToBottom = this.isScrolledToBottom();

			this.messageListElement.innerHTML = ''; // Очищаем
			const fragment = document.createDocumentFragment();
			this.messages.forEach((message) => {
				const messageElement = this.createMessageElement(message);
				fragment.append(messageElement);
			});
			this.messageListElement.append(fragment);

			// Прокручиваем вниз только если пользователь был внизу до обновления
			if (shouldScrollToBottom) {
				this.scrollToBottom();
			}
			// TODO: Реализовать логику прокрутки к разделителю непрочитанных
		} else if (this.currentChatPartner) {
			// Если партнер выбран, но сообщений нет после фильтрации (маловероятно)
			this.showPlaceholder(
				`No messages with ${this.currentChatPartner.login} yet.`,
			);
		} else {
			this.showPlaceholder('Select a chat to start messaging');
		}
	}

	// Создает элемент сообщения
	private createMessageElement(message: MessageData): HTMLElement {
		const currentUserLogin = this.stateService.getCurrentUser()?.login;
		const isOutgoing = message.from === currentUserLogin;

		const messageClasses = [
			classes['message-item'],
			isOutgoing
				? classes['message-item--outgoing']
				: classes['message-item--incoming'],
		];

		const messageDate = new Date(message.datetime);
		const formattedTime = messageDate.toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
		});
		// const formattedDate = messageDate.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });

		const senderElement = ElementCreator.create({
			tag: 'div',
			classes: classes['message-sender'],
			content: isOutgoing ? 'You' : message.from,
		});
		const timeElement = ElementCreator.create({
			tag: 'div',
			classes: classes['message-time'],
			content: formattedTime,
		});
		const headerElement = ElementCreator.create({
			tag: 'div',
			classes: classes['message-header'],
			children: [senderElement, timeElement],
		});

		const textElement = ElementCreator.create({
			tag: 'div',
			classes: classes['message-text'],
			content: message.text,
		});

		let statusElement: HTMLElement | null = null;
		if (isOutgoing) {
			let statusText = 'Sent';
			if (message.status.isReaded) statusText = 'Read';
			else if (message.status.isDelivered) statusText = 'Delivered';
			if (message.status.isEdited) statusText += ' (edited)';

			statusElement = ElementCreator.create({
				tag: 'div',
				classes: classes['message-status'],
				content: statusText,
			}) as HTMLElement;
		}

		const messageElement = ElementCreator.create({
			tag: 'div',
			classes: messageClasses,
			children: [headerElement, textElement, statusElement].filter(
				Boolean,
			) as HTMLElement[],
		}) as HTMLElement;

		// TODO: Добавить кнопки Edit/Delete для исходящих

		return messageElement;
	}

	// --- Обработчики ввода и отправки ---
	private handleSendClick(): void {
		this.sendMessage();
	}
	private handleInputKeyDown(event: KeyboardEvent): void {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			this.sendMessage();
		}
	}

	// --- Метод отправки сообщения ---
	private sendMessage(): void {
		const text = this.messageInput.value.trim();
		const recipient = this.currentChatPartner;

		// Проверяем, есть ли текст и выбран ли получатель
		if (!text || !recipient) {
			console.warn('Cannot send message: No text or recipient selected.');
			if (!text && this.messageInput) {
				// Можно добавить визуальную обратную связь, если поле пустое
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

		console.log(`Sending message to ${recipient.login}: ${text}`);
		// Блокируем ввод и кнопку на время отправки
		const originalButtonText = this.sendButton.textContent;
		this.messageInput.disabled = true;
		this.sendButton.disabled = true;
		this.sendButton.textContent = 'Sending...'; // Индикация отправки
		this.sendButton.classList.add('button--loading'); // Визуальный лоадер

		void (async (): Promise<void> => {
			try {
				// Вызываем сервис для отправки
				const sentMessage = await this.messageService.sendMessage(
					recipient.login,
					text,
				);
				console.log('Message sent:', sentMessage);
				// Успешно! Очищаем поле ввода.
				this.messageInput.value = '';
				this.autoResizeInput(); // Сбрасываем высоту textarea
				// Оптимистичное добавление (не обязательно, т.к. придет уведомление)
				// this.messages.push(sentMessage);
				// this.renderMessages(); // Можно сразу отрендерить
				this.scrollToBottom(); // Прокручиваем вниз после отправки
			} catch (error) {
				console.error('Failed to send message:', error);
				// Показываем ошибку пользователю (можно через EventBus или локально)
				alert(
					`Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`,
				);
			} finally {
				// Разблокируем ввод и кнопку в любом случае
				if (this.messageInput) this.messageInput.disabled = false; // Проверка на null
				if (this.sendButton) {
					this.sendButton.disabled = false;
					this.sendButton.textContent = originalButtonText; // Возвращаем текст кнопки
					this.sendButton.classList.remove('button--loading'); // Убираем лоадер
				}
				if (this.messageInput) this.messageInput.focus(); // Возвращаем фокус
			}
		})();
	}

	// --- Вспомогательные методы ---

	// Автоматическое изменение высоты textarea
	private autoResizeInput(): void {
		if (!this.messageInput) return;
		// Сбрасываем высоту, чтобы textarea могла сжаться, если текст удален
		this.messageInput.style.height = 'auto';
		// Устанавливаем новую высоту, ограниченную максимальной
		const maxHeight = 150; // Макс. высота в пикселях
		const scrollHeight = this.messageInput.scrollHeight;
		const newHeight = Math.min(scrollHeight, maxHeight);
		this.messageInput.style.height = `${newHeight}px`;
		// Показываем скролл, только если достигнута макс. высота
		this.messageInput.style.overflowY =
			scrollHeight > maxHeight ? 'auto' : 'hidden';
	}

	// Прокрутка списка сообщений вниз
	private scrollToBottom(behavior: ScrollBehavior = 'smooth'): void {
		if (this.messageListElement) {
			// Даем браузеру время отрисовать новые сообщения перед прокруткой
			requestAnimationFrame(() => {
				if (this.messageListElement) {
					// Проверка нужна снова внутри RAF
					this.messageListElement.scrollTo({
						top: this.messageListElement.scrollHeight,
						behavior: behavior, // 'smooth' или 'auto'
					});
				}
			});
		}
	}

	// Проверяет, находится ли пользователь внизу списка сообщений
	private isScrolledToBottom(): boolean {
		if (!this.messageListElement) return true; // Если элемента нет, считаем, что внизу
		const threshold = 10; // Погрешность в пикселях
		return (
			this.messageListElement.scrollHeight -
				this.messageListElement.scrollTop -
				this.messageListElement.clientHeight <=
			threshold
		);
	}

	private showLoadingState(isLoading: boolean): void {
		// console.log('Chat loading state:', isLoading);
		const loadingClass = classes['chat-area--loading'];

		// Проверяем наличие класса
		if (loadingClass) {
			// Используем add/remove
			if (isLoading) {
				this.addClass(loadingClass); // Используем метод BaseComponent
				this.showPlaceholder('Loading messages...');
			} else {
				this.removeClass(loadingClass); // Используем метод BaseComponent
			}
		} else {
			console.warn(
				"ChatAreaComponent: Loading CSS class 'chat-area--loading' not found in module!",
			);
			// Если класса нет, просто обновляем плейсхолдеры
			if (isLoading) {
				this.showPlaceholder('Loading messages...');
			} // Логику для !isLoading оставим ниже
		}

		// Обновляем плейсхолдер/список в зависимости от состояния ПОСЛЕ загрузки
		if (!isLoading) {
			if (this.messages.length === 0 && this.currentChatPartner) {
				this.showPlaceholder(
					`This is the beginning of your conversation with ${this.currentChatPartner.login}`,
				);
			} else if (this.messages.length > 0) {
				this.hidePlaceholder();
			} else if (!this.currentChatPartner) {
				// Если чат не выбран (маловероятно попасть сюда при isLoading=false, но на всякий случай)
				this.showPlaceholder('Select a chat to start messaging');
			}
		}
	}
}

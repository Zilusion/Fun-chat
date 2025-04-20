import type { WebSocketService } from './web-socket-service';
// Импортируем нужные типы из API для payload'ов запросов и ответов
import type {
	MessageData,
	MessageDeleteResponsePayload,
	MessageEditResponsePayload,
	MessageFromUserResponsePayload,
	MessageReadResponsePayload,
	MessageSendResponsePayload,
} from '../types/api-types';
import type { EventBus } from './event-bus';

/**
 * Сервис для инкапсуляции логики взаимодействия с API сообщений чата.
 */
export class MessageService {
	private readonly wsService: WebSocketService;
	private readonly eventBus: EventBus;
	// EventBus пока не нужен, если сервис только отправляет запросы и возвращает результат

	constructor(wsService: WebSocketService, eventBus: EventBus) {
		this.wsService = wsService;
		this.eventBus = eventBus;
	}

	/**
	 * Отправляет текстовое сообщение указанному пользователю.
	 * @param recipientLogin - Логин получателя.
	 * @param messageText - Текст сообщения.
	 * @returns Promise, который разрешится с данными отправленного сообщения (включая ID, время и т.д.).
	 * @throws Ошибка, если отправка не удалась (ошибка сети, API или валидации сервера).
	 */
	public async sendMessage(
		recipientLogin: string,
		messageText: string,
	): Promise<MessageData> {
		// Проверка на пустой текст может быть здесь или в UI
		if (!messageText.trim()) {
			throw new Error('Cannot send an empty message.');
		}

		try {
			console.log(
				`MessageService: Sending message to ${recipientLogin}...`,
			);
			// Вызываем wsService.send с типом 'MSG_SEND'.
			// TypeScript автоматически выведет типы payload запроса и ответа
			// благодаря RequestPayloadMap и ResponsePayloadMap.
			const responsePayload: MessageSendResponsePayload =
				await this.wsService.send('MSG_SEND', {
					message: {
						to: recipientLogin,
						text: messageText.trim(), // Убираем лишние пробелы
					},
				});
			const sentMessageData = responsePayload.message;
			console.log(
				`MessageService: Message sent successfully (ID: ${responsePayload.message.id})`,
			);
			// Возвращаем объект сообщения из payload ответа
			this.eventBus.publish('message:sentSuccessfully', sentMessageData);
			return responsePayload.message;
		} catch (error) {
			console.error(
				`MessageService: Failed to send message to ${recipientLogin}:`,
				error,
			);
			// Пробрасываем ошибку дальше, чтобы ее можно было обработать в вызывающем коде (UI)
			throw error;
		}
	}

	/**
	 * Запрашивает историю сообщений с указанным пользователем.
	 * @param userId - Логин пользователя, с которым запрашивается история.
	 * @returns Promise, который разрешится с массивом сообщений (MessageData[]), отсортированным по времени.
	 * @throws Ошибка, если запрос не удался.
	 */
	public async fetchMessages(userId: string): Promise<MessageData[]> {
		try {
			console.log(
				`MessageService: Fetching message history with ${userId}...`,
			);
			const responsePayload: MessageFromUserResponsePayload =
				await this.wsService.send('MSG_FROM_USER', {
					user: { login: userId },
				});
			console.log(
				`MessageService: Message history with ${userId} fetched (${responsePayload.messages.length} messages).`,
			);
			// Сервер обещает отсортированный массив
			return responsePayload.messages;
		} catch (error) {
			console.error(
				`MessageService: Failed to fetch messages for ${userId}:`,
				error,
			);
			throw error;
		}
	}

	/**
	 * Отправляет запрос на пометку сообщения как прочитанного.
	 * Вызывается, когда пользователь открывает чат или прокручивает к непрочитанным.
	 * @param messageId - ID сообщения, которое помечается как прочитанное.
	 * @returns Promise, который разрешится с payload'ом ответа сервера (содержащим статус isReaded).
	 * @throws Ошибка, если запрос не удался.
	 */
	public async markMessageAsRead(
		messageId: string,
	): Promise<MessageReadResponsePayload> {
		try {
			// console.log(`MessageService: Marking message ${messageId} as read...`); // Можно логировать меньше
			const responsePayload: MessageReadResponsePayload =
				await this.wsService.send('MSG_READ', {
					message: { id: messageId },
				});
			// console.log(`MessageService: Message ${messageId} marked as read.`);
			return responsePayload;
		} catch (error) {
			console.error(
				`MessageService: Failed to mark message ${messageId} as read:`,
				error,
			);
			throw error;
		}
	}

	/**
	 * Отправляет запрос на удаление сообщения (только для своих сообщений).
	 * @param messageId - ID сообщения для удаления.
	 * @returns Promise, который разрешится с payload'ом ответа сервера (содержащим статус isDeleted).
	 * @throws Ошибка, если запрос не удался (например, не автор сообщения).
	 */
	public async deleteMessage(
		messageId: string,
	): Promise<MessageDeleteResponsePayload> {
		try {
			console.log(`MessageService: Deleting message ${messageId}...`);
			const responsePayload: MessageDeleteResponsePayload =
				await this.wsService.send('MSG_DELETE', {
					message: { id: messageId },
				});
			console.log(`MessageService: Message ${messageId} deleted.`);
			this.eventBus.publish(
				'message:deletedSuccessfully',
				responsePayload,
			);
			return responsePayload;
		} catch (error) {
			console.error(
				`MessageService: Failed to delete message ${messageId}:`,
				error,
			);
			throw error;
		}
	}

	/**
	 * Отправляет запрос на редактирование текста сообщения (только для своих сообщений).
	 * @param messageId - ID сообщения для редактирования.
	 * @param newText - Новый текст сообщения.
	 * @returns Promise, который разрешится с payload'ом ответа сервера (содержащим новый текст и статус isEdited).
	 * @throws Ошибка, если запрос не удался.
	 */
	public async editMessage(
		messageId: string,
		newText: string,
	): Promise<MessageEditResponsePayload> {
		if (!newText.trim()) {
			throw new Error('Cannot edit message to be empty.');
		}
		try {
			console.log(`MessageService: Editing message ${messageId}...`);
			const responsePayload: MessageEditResponsePayload =
				await this.wsService.send('MSG_EDIT', {
					message: { id: messageId, text: newText.trim() },
				});
			console.log(`MessageService: Message ${messageId} edited.`);
			this.eventBus.publish(
				'message:editedSuccessfully',
				responsePayload,
			);
			return responsePayload;
		} catch (error) {
			console.error(
				`MessageService: Failed to edit message ${messageId}:`,
				error,
			);
			throw error;
		}
	}
}

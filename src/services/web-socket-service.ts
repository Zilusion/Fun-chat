import {
	isMessageDeleteResponsePayload,
	isMessageEditResponsePayload,
	isMessageFromUserResponsePayload,
	isMessageReadResponsePayload,
	isMessageSendResponsePayload,
	isUserActiveResponsePayload,
	isUserInactiveResponsePayload,
	isUserLoginResponsePayload,
	isUserLogoutResponsePayload,
	// --- Новые импорты для payload уведомлений ---
	isMessageDeliverPayload,
	isUserExternalLoginPayload,
	isUserExternalLogoutPayload,
	// -------------------------------------------
	type ClientRequestType,
	type RequestPayloadMap,
	type ResponsePayloadMap,
} from '../types/api-mappings';
// Базовые типы и type guards
import type { BaseSocketMessage } from '../types/api-types';
import {
	isBaseSocketMessage,
	isErrorResponse,
	isServerNotification,
	isServerResponse,
} from '../types/api-types';
// Импорт EventBus
import type { EventBus } from './event-bus'; // Импортируем тип
// Импорты из types/events могут понадобиться для проверки типов payload
// import type {
// 	MessageSendResponsePayload,
// 	MessageDeliverPayload,
// 	MessageReadResponsePayload,
// 	MessageDeleteResponsePayload,
// 	MessageEditResponsePayload,
// 	UserExternalLoginPayload,
// 	UserExternalLogoutPayload,
// } from '../types/api-types'; // Импорты для явного указания типов payload при публикации

// Тип ConnectionStatus остается здесь
export type ConnectionStatus =
	| 'connecting'
	| 'connected'
	| 'disconnected'
	| 'reconnecting';

// Тип PendingRequest остается прежним
type PendingRequest<TResolvePayload = unknown> = {
	resolve: (value: TResolvePayload | PromiseLike<TResolvePayload>) => void;
	reject: (reason?: unknown) => void;
	timeoutId: ReturnType<typeof setTimeout>;
};

export class WebSocketService {
	private ws: WebSocket | null = null;
	private url: string;
	private status: ConnectionStatus = 'disconnected';
	private pendingRequests: Map<string, PendingRequest> = new Map();
	private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
	private reconnectAttempts: number = 0;
	private readonly MAX_RECONNECT_ATTEMPTS = 5;
	private readonly RECONNECT_DELAY_MS = 3000;

	// Добавляем приватное свойство для EventBus
	private readonly eventBus: EventBus;

	/**
	 * Конструктор принимает URL сервера и экземпляр EventBus.
	 * @param url URL WebSocket сервера.
	 * @param eventBus Экземпляр EventBus для публикации событий.
	 */
	constructor(url: string, eventBus: EventBus) {
		this.url = url;
		this.eventBus = eventBus; // Сохраняем экземпляр EventBus
	}

	// connect - без изменений в логике, но теперь использует this.eventBus
	public connect(): void {
		if (
			this.ws &&
			this.ws.readyState !== WebSocket.CLOSED &&
			this.ws.readyState !== WebSocket.CLOSING
		) {
			console.warn('WebSocket is already connected or connecting.');
			return;
		}
		console.log(`WebSocket: Attempting to connect to ${this.url}...`);
		this.setStatus('connecting'); // setStatus опубликует событие
		this.ws = new WebSocket(this.url);
		this.ws.addEventListener('open', this.handleOpen.bind(this));
		this.ws.addEventListener('message', this.handleMessage.bind(this));
		this.ws.addEventListener('error', this.handleError.bind(this));
		this.ws.addEventListener('close', this.handleClose.bind(this));
	}

	// disconnect - без изменений
	public disconnect(): void {
		if (this.reconnectTimeoutId) {
			clearTimeout(this.reconnectTimeoutId);
			this.reconnectTimeoutId = null;
		}
		this.clearAllPendingRequestTimeouts();
		this.pendingRequests.forEach((request) =>
			request.reject(new Error('WebSocket disconnected manually.')),
		);
		this.pendingRequests.clear();

		if (
			this.ws &&
			this.ws.readyState !== WebSocket.CLOSING &&
			this.ws.readyState !== WebSocket.CLOSED
		) {
			console.log('WebSocket: Disconnecting manually.');
			this.ws.close(); // Вызовет handleClose, который опубликует событие
		} else {
			this.setStatus('disconnected'); // Опубликует событие, если статус изменился
		}
	}

	// send - без изменений
	public send<T extends ClientRequestType>(
		type: T,
		payload: RequestPayloadMap[T],
	): Promise<ResponsePayloadMap[T]> {
		return new Promise((resolve, reject) => {
			if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
				reject(new Error('WebSocket is not connected.'));
				return;
			}

			const id = this.generateRequestId();
			const request: BaseSocketMessage<T, RequestPayloadMap[T]> = {
				id,
				type,
				payload,
			};

			try {
				const messageString = JSON.stringify(request);

				const timeoutId = setTimeout(() => {
					if (this.pendingRequests.has(id)) {
						const specificPending = this.pendingRequests.get(id);
						this.pendingRequests.delete(id);
						specificPending?.reject(
							new Error(`Request timeout for ${type} (${id})`),
						);
					}
				}, 15000);

				this.pendingRequests.set(id, {
					resolve: resolve as (value: unknown) => void,
					reject,
					timeoutId,
				});

				this.ws.send(messageString);
				console.log('WebSocket: Sent:', request);
			} catch (error) {
				console.error('WebSocket: Send error:', error);
				// При ошибке отправки промис отклоняется сразу, не добавляясь в pendingRequests
				reject(
					error instanceof Error
						? error
						: new Error('Failed to send WebSocket message'),
				);
			}
		});
	}

	// getStatus - без изменений
	public getStatus(): ConnectionStatus {
		return this.status;
	}

	// clearAllPendingRequestTimeouts - без изменений
	private clearAllPendingRequestTimeouts(): void {
		this.pendingRequests.forEach((request) => {
			clearTimeout(request.timeoutId);
		});
	}

	// --- Обработчики событий WebSocket ---

	// handleOpen - Публикует 'websocket:open'
	private handleOpen(): void {
		console.log('WebSocket: Connection established.');
		// setStatus опубликует 'websocket:status'
		this.setStatus('connected');
		this.reconnectAttempts = 0;
		if (this.reconnectTimeoutId) {
			clearTimeout(this.reconnectTimeoutId);
			this.reconnectTimeoutId = null;
		}
		// Публикуем событие открытия соединения
		this.eventBus.publish('websocket:open'); // Используем undefined для void

		// TODO: Trigger re-authentication if needed
	}

	// handleMessage - без изменений (вызывает другие обработчики)
	private handleMessage(event: MessageEvent): void {
		let parsedData: unknown;
		try {
			if (typeof event.data === 'string') {
				parsedData = JSON.parse(event.data);
			} else {
				console.error(
					'WebSocket: Received non-string message:',
					event.data,
				);
				return;
			}
		} catch (error) {
			console.error(
				'WebSocket: Failed to parse message:',
				event.data,
				error,
			);
			return;
		}

		if (!isBaseSocketMessage(parsedData)) {
			console.error(
				'WebSocket: Received message with incorrect structure:',
				parsedData,
			);
			return;
		}

		if (isServerNotification(parsedData)) {
			this.handleServerNotification(parsedData);
		} else if (isServerResponse(parsedData)) {
			this.handleServerResponse(parsedData);
		} else {
			console.error(
				'WebSocket: Received message with invalid id type:',
				parsedData.id,
			);
		}
	}

	// handleServerNotification - Публикует конкретные события 'server:*'
	private handleServerNotification(
		notification: BaseSocketMessage<string, unknown> & { id: null },
	): void {
		console.log(
			`WebSocket: Received notification: ${notification.type}`, // Уменьшаем логирование payload по умолчанию
		);
		const payload = notification.payload; // payload is unknown

		try {
			// Используем switch и соответствующие type guards ПЕРЕД публикацией
			switch (notification.type) {
				case 'USER_EXTERNAL_LOGIN': {
					if (isUserExternalLoginPayload(payload)) {
						// Публикуем событие с типизированным payload
						this.eventBus.publish(
							'server:userExternalLogin', // Соответствует имени в events.ts
							payload, // payload теперь UserExternalLoginPayload
						);
					} else {
						// Логируем ошибку, если структура payload неверна
						console.warn(
							`WebSocket: Invalid payload structure for ${notification.type}:`,
							payload,
						);
					}
					break;
				}
				case 'USER_EXTERNAL_LOGOUT': {
					if (isUserExternalLogoutPayload(payload)) {
						this.eventBus.publish(
							'server:userExternalLogout', // Соответствует имени в events.ts
							payload, // payload теперь UserExternalLogoutPayload
						);
					} else {
						console.warn(
							`WebSocket: Invalid payload structure for ${notification.type}:`,
							payload,
						);
					}
					break;
				}
				case 'MSG_SEND': {
					// Сервер прислал новое сообщение для нас
					if (isMessageSendResponsePayload(payload)) {
						// Используем тот же guard, что и для ответа на MSG_SEND
						this.eventBus.publish(
							'server:messageReceived', // Соответствует имени в events.ts
							payload, // payload теперь MessageSendResponsePayload
						);
					} else {
						console.warn(
							`WebSocket: Invalid payload structure for ${notification.type} notification:`,
							payload,
						);
					}
					break;
				}
				case 'MSG_DELIVER': {
					// Статус нашего сообщения изменен на "доставлено"
					if (isMessageDeliverPayload(payload)) {
						this.eventBus.publish(
							'server:messageDelivered', // Соответствует имени в events.ts
							payload, // payload теперь MessageDeliverPayload
						);
					} else {
						console.warn(
							`WebSocket: Invalid payload structure for ${notification.type}:`,
							payload,
						);
					}
					break;
				}
				case 'MSG_READ': {
					// Наше сообщение было прочитано получателем
					if (isMessageReadResponsePayload(payload)) {
						// Используем тот же guard, что и для ответа на MSG_READ
						this.eventBus.publish(
							'server:messageRead', // Соответствует имени в events.ts
							payload, // payload теперь MessageReadResponsePayload
						);
					} else {
						console.warn(
							`WebSocket: Invalid payload structure for ${notification.type} notification:`,
							payload,
						);
					}
					break;
				}
				case 'MSG_DELETE': {
					// Сообщение (возможно, не наше) было удалено в одном из наших чатов
					if (isMessageDeleteResponsePayload(payload)) {
						// Используем тот же guard, что и для ответа на MSG_DELETE
						this.eventBus.publish(
							'server:messageDeleted', // Соответствует имени в events.ts
							payload, // payload теперь MessageDeleteResponsePayload
						);
					} else {
						console.warn(
							`WebSocket: Invalid payload structure for ${notification.type} notification:`,
							payload,
						);
					}
					break;
				}
				case 'MSG_EDIT': {
					// Сообщение (возможно, не наше) было отредактировано в одном из наших чатов
					if (isMessageEditResponsePayload(payload)) {
						// Используем тот же guard, что и для ответа на MSG_EDIT
						this.eventBus.publish(
							'server:messageEdited', // Соответствует имени в events.ts
							payload, // payload теперь MessageEditResponsePayload
						);
					} else {
						console.warn(
							`WebSocket: Invalid payload structure for ${notification.type} notification:`,
							payload,
						);
					}
					break;
				}
				default: {
					// Обработка неизвестных типов уведомлений
					console.warn(
						'WebSocket: Received unhandled notification type:',
						notification.type,
					);
					// Можно опубликовать общее событие для неизвестных типов, если нужно
					// this.eventBus.publish('websocket:notification', { type: notification.type, payload });
				}
			}
		} catch (error) {
			// Ловим ошибки, которые могут возникнуть в type guards или при публикации события
			console.error(
				`WebSocket: Error handling server notification "${notification.type}":`,
				error,
			);
		}
	}

	// handleServerResponse - без изменений (не публикует события)
	private handleServerResponse(
		response: BaseSocketMessage<string, unknown> & { id: string },
	): void {
		const requestId = response.id;
		// console.log('WebSocket: Received response for id:', requestId, response.type); // Можно уменьшить логирование
		const pending = this.pendingRequests.get(requestId);
		if (!pending) {
			return;
		} // Ignore if not pending

		clearTimeout(pending.timeoutId); // Clear timeout first
		this.pendingRequests.delete(requestId); // Remove from map

		if (isErrorResponse(response)) {
			// console.error(`WebSocket: Error response for ${response.type} (${requestId}):`, response.payload.error); // Можно уменьшить
			pending.reject(new Error(response.payload.error));
		} else {
			let isValidPayload = false;
			const payload = response.payload;
			switch (response.type) {
				case 'USER_LOGIN': {
					isValidPayload = isUserLoginResponsePayload(payload);
					break;
				}
				case 'USER_LOGOUT': {
					isValidPayload = isUserLogoutResponsePayload(payload);
					break;
				}
				case 'USER_ACTIVE': {
					isValidPayload = isUserActiveResponsePayload(payload);
					break;
				}
				case 'USER_INACTIVE': {
					isValidPayload = isUserInactiveResponsePayload(payload);
					break;
				}
				case 'MSG_SEND': {
					isValidPayload = isMessageSendResponsePayload(payload);
					break;
				}
				case 'MSG_FROM_USER': {
					isValidPayload = isMessageFromUserResponsePayload(payload);
					break;
				}
				case 'MSG_READ': {
					isValidPayload = isMessageReadResponsePayload(payload);
					break;
				}
				case 'MSG_DELETE': {
					isValidPayload = isMessageDeleteResponsePayload(payload);
					break;
				}
				case 'MSG_EDIT': {
					isValidPayload = isMessageEditResponsePayload(payload);
					break;
				}
				default: {
					console.warn(
						`WebSocket: Received unexpected successful response type: ${response.type} for request ${requestId}`,
					);
					pending.reject(
						new Error(
							`Received unexpected successful response type: ${response.type}`,
						),
					);
					return;
				}
			}

			if (isValidPayload) {
				// console.log(`WebSocket: Payload validated for ${response.type} (${requestId}). Resolving promise.`); // Можно уменьшить
				pending.resolve(payload);
			} else {
				const errorMessage = `Invalid payload structure received for response type ${response.type} (request ${requestId})`;
				console.error(errorMessage, payload);
				pending.reject(new Error(errorMessage));
			}
		}
	}

	// handleError - Публикует 'websocket:error'
	private handleError(event: Event): void {
		console.error('WebSocket: Error occurred:', event);
		// Публикуем событие ошибки
		this.eventBus.publish('websocket:error', event);
	}

	// handleClose - Публикует 'websocket:close'
	private handleClose(event: CloseEvent): void {
		const closePayload = {
			code: event.code,
			reason: event.reason,
			wasClean: event.wasClean,
		};
		console.log('WebSocket: Connection closed.', closePayload);
		this.ws = null;

		this.clearAllPendingRequestTimeouts();
		this.pendingRequests.forEach((request) => {
			// console.log(`WebSocket: Rejecting pending request ${id} due to close.`); // Можно уменьшить
			request.reject(
				new Error(`WebSocket closed unexpectedly. Code: ${event.code}`),
			);
		});
		this.pendingRequests.clear();

		const previousStatus = this.status;
		// setStatus опубликует 'websocket:status'
		this.setStatus('disconnected');

		// Публикуем событие закрытия ПОСЛЕ установки статуса и очистки
		this.eventBus.publish('websocket:close', closePayload);

		if (!event.wasClean && previousStatus !== 'disconnected') {
			this.scheduleReconnect();
		}
	}

	// --- Вспомогательные методы ---

	// setStatus - Публикует 'websocket:status'
	private setStatus(status: ConnectionStatus): void {
		if (this.status !== status) {
			const oldStatus = this.status;
			this.status = status;
			console.log(
				`WebSocket: Status changed from ${oldStatus} to ${status}`,
			);
			// Публикуем событие изменения статуса
			this.eventBus.publish('websocket:status', status);
		}
	}

	// scheduleReconnect - без изменений
	private scheduleReconnect(): void {
		if (this.status === 'connecting' || this.status === 'connected') return;
		if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
			console.error(
				`WebSocket: Reached max reconnect attempts (${this.MAX_RECONNECT_ATTEMPTS}). Giving up.`,
			);
			this.setStatus('disconnected'); // Опубликует статус
			return;
		}
		this.reconnectAttempts++;
		const delay =
			this.RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
		console.log(
			`WebSocket: Scheduling reconnect attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${delay / 1000} seconds...`,
		);
		this.setStatus('reconnecting'); // Опубликует статус

		if (this.reconnectTimeoutId) clearTimeout(this.reconnectTimeoutId);

		this.reconnectTimeoutId = globalThis.setTimeout(() => {
			this.reconnectTimeoutId = null;
			if (this.status === 'reconnecting') {
				console.log(
					`WebSocket: Executing reconnect attempt ${this.reconnectAttempts}...`,
				);
				this.connect();
			} else {
				console.log(
					`WebSocket: Reconnect attempt ${this.reconnectAttempts} cancelled (status changed).`,
				);
			}
		}, delay);
	}

	// generateRequestId - без изменений
	private generateRequestId(): string {
		return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
	}
}

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
	isMessageDeliverPayload,
	isUserExternalLoginPayload,
	isUserExternalLogoutPayload,
	type ClientRequestType,
	type RequestPayloadMap,
	type ResponsePayloadMap,
} from '../types/api-mappings';
import type { BaseSocketMessage } from '../types/api-types';
import {
	isBaseSocketMessage,
	isErrorResponse,
	isServerNotification,
	isServerResponse,
} from '../types/api-types';
import type { EventBus } from './event-bus';

export type ConnectionStatus =
	| 'connecting'
	| 'connected'
	| 'disconnected'
	| 'reconnecting';

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

	private readonly eventBus: EventBus;

	constructor(url: string, eventBus: EventBus) {
		this.url = url;
		this.eventBus = eventBus;
	}

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
		this.setStatus('connecting');
		this.ws = new WebSocket(this.url);
		this.ws.addEventListener('open', this.handleOpen.bind(this));
		this.ws.addEventListener('message', this.handleMessage.bind(this));
		this.ws.addEventListener('error', this.handleError.bind(this));
		this.ws.addEventListener('close', this.handleClose.bind(this));
	}

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
			this.ws.close();
		} else {
			this.setStatus('disconnected');
		}
	}

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
				reject(
					error instanceof Error
						? error
						: new Error('Failed to send WebSocket message'),
				);
			}
		});
	}

	public getStatus(): ConnectionStatus {
		return this.status;
	}

	private clearAllPendingRequestTimeouts(): void {
		this.pendingRequests.forEach((request) => {
			clearTimeout(request.timeoutId);
		});
	}

	private handleOpen(): void {
		console.log('WebSocket: Connection established.');
		this.setStatus('connected');
		this.reconnectAttempts = 0;
		if (this.reconnectTimeoutId) {
			clearTimeout(this.reconnectTimeoutId);
			this.reconnectTimeoutId = null;
		}
		this.eventBus.publish('websocket:open');
	}

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

	private handleServerNotification(
		notification: BaseSocketMessage<string, unknown> & { id: null },
	): void {
		console.log(`WebSocket: Received notification: ${notification.type}`);
		const payload = notification.payload;

		try {
			switch (notification.type) {
				case 'USER_EXTERNAL_LOGIN': {
					if (isUserExternalLoginPayload(payload)) {
						this.eventBus.publish(
							'server:userExternalLogin',
							payload,
						);
					} else {
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
							'server:userExternalLogout',
							payload,
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
					if (isMessageSendResponsePayload(payload)) {
						this.eventBus.publish(
							'server:messageReceived',
							payload,
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
					if (isMessageDeliverPayload(payload)) {
						this.eventBus.publish(
							'server:messageDelivered',
							payload,
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
					if (isMessageReadResponsePayload(payload)) {
						this.eventBus.publish('server:messageRead', payload);
					} else {
						console.warn(
							`WebSocket: Invalid payload structure for ${notification.type} notification:`,
							payload,
						);
					}
					break;
				}
				case 'MSG_DELETE': {
					if (isMessageDeleteResponsePayload(payload)) {
						this.eventBus.publish('server:messageDeleted', payload);
					} else {
						console.warn(
							`WebSocket: Invalid payload structure for ${notification.type} notification:`,
							payload,
						);
					}
					break;
				}
				case 'MSG_EDIT': {
					if (isMessageEditResponsePayload(payload)) {
						this.eventBus.publish('server:messageEdited', payload);
					} else {
						console.warn(
							`WebSocket: Invalid payload structure for ${notification.type} notification:`,
							payload,
						);
					}
					break;
				}
				default: {
					console.warn(
						'WebSocket: Received unhandled notification type:',
						notification.type,
					);
				}
			}
		} catch (error) {
			console.error(
				`WebSocket: Error handling server notification "${notification.type}":`,
				error,
			);
		}
	}

	private handleServerResponse(
		response: BaseSocketMessage<string, unknown> & { id: string },
	): void {
		const requestId = response.id;
		const pending = this.pendingRequests.get(requestId);
		if (!pending) {
			return;
		}

		clearTimeout(pending.timeoutId);
		this.pendingRequests.delete(requestId);

		if (isErrorResponse(response)) {
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
				pending.resolve(payload);
			} else {
				const errorMessage = `Invalid payload structure received for response type ${response.type} (request ${requestId})`;
				console.error(errorMessage, payload);
				pending.reject(new Error(errorMessage));
			}
		}
	}

	private handleError(event: Event): void {
		console.error('WebSocket: Error occurred:', event);
		this.eventBus.publish('websocket:error', event);
	}

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
			request.reject(
				new Error(`WebSocket closed unexpectedly. Code: ${event.code}`),
			);
		});
		this.pendingRequests.clear();

		const previousStatus = this.status;
		this.setStatus('disconnected');

		this.eventBus.publish('websocket:close', closePayload);

		if (!event.wasClean && previousStatus !== 'disconnected') {
			this.scheduleReconnect();
		}
	}

	private setStatus(status: ConnectionStatus): void {
		if (this.status !== status) {
			const oldStatus = this.status;
			this.status = status;
			console.log(
				`WebSocket: Status changed from ${oldStatus} to ${status}`,
			);
			this.eventBus.publish('websocket:status', status);
		}
	}

	private scheduleReconnect(): void {
		if (this.status === 'connecting' || this.status === 'connected') return;
		if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
			console.error(
				`WebSocket: Reached max reconnect attempts (${this.MAX_RECONNECT_ATTEMPTS}). Giving up.`,
			);
			this.setStatus('disconnected');
			return;
		}
		this.reconnectAttempts++;
		const delay =
			this.RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts - 1);
		console.log(
			`WebSocket: Scheduling reconnect attempt ${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS} in ${delay / 1000} seconds...`,
		);
		this.setStatus('reconnecting');

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

	private generateRequestId(): string {
		return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
	}
}

import type { WebSocketService } from './web-socket-service';
import type {
	MessageData,
	MessageDeleteResponsePayload,
	MessageEditResponsePayload,
	MessageFromUserResponsePayload,
	MessageReadResponsePayload,
	MessageSendResponsePayload,
} from '../types/api-types';
import type { EventBus } from './event-bus';

export class MessageService {
	private readonly wsService: WebSocketService;
	private readonly eventBus: EventBus;

	constructor(wsService: WebSocketService, eventBus: EventBus) {
		this.wsService = wsService;
		this.eventBus = eventBus;
	}

	public async sendMessage(
		recipientLogin: string,
		messageText: string,
	): Promise<MessageData> {
		if (!messageText.trim()) {
			throw new Error('Cannot send an empty message.');
		}

		try {
			console.log(
				`MessageService: Sending message to ${recipientLogin}...`,
			);
			const responsePayload: MessageSendResponsePayload =
				await this.wsService.send('MSG_SEND', {
					message: {
						to: recipientLogin,
						text: messageText.trim(),
					},
				});
			const sentMessageData = responsePayload.message;
			console.log(
				`MessageService: Message sent successfully (ID: ${responsePayload.message.id})`,
			);
			this.eventBus.publish('message:sentSuccessfully', sentMessageData);
			return responsePayload.message;
		} catch (error) {
			console.error(
				`MessageService: Failed to send message to ${recipientLogin}:`,
				error,
			);
			throw error;
		}
	}

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
			return responsePayload.messages;
		} catch (error) {
			console.error(
				`MessageService: Failed to fetch messages for ${userId}:`,
				error,
			);
			throw error;
		}
	}

	public async markMessageAsRead(
		messageId: string,
	): Promise<MessageReadResponsePayload> {
		try {
			const responsePayload: MessageReadResponsePayload =
				await this.wsService.send('MSG_READ', {
					message: { id: messageId },
				});
			return responsePayload;
		} catch (error) {
			console.error(
				`MessageService: Failed to mark message ${messageId} as read:`,
				error,
			);
			throw error;
		}
	}

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

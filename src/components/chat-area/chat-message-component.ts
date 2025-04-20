// src/components/chat-area/chat-message-component.ts
import type { MessageData } from '../../types/api-types';
import type { StateService } from '../../services/state-service';
import ElementCreator from '../../utils/element-creator';
import { BaseComponent } from '../base/component';
import classes from './_chat-area-component.module.scss';

export type ChatMessageComponentOptions = {
	message: MessageData;
	stateService: StateService;
	onDelete: (messageId: string) => void;
	onEdit: (messageId: string, currentText: string) => void;
};

export class ChatMessageComponent extends BaseComponent<HTMLDivElement> {
	private messageData: MessageData;
	private readonly onDeleteCallback: (messageId: string) => void;
	private readonly onEditCallback: (
		messageId: string,
		currentText: string,
	) => void;
	private readonly isOutgoing: boolean;

	private statusElement: HTMLElement | null = null;
	private editedIndicatorElement: HTMLElement | null = null;
	private textElement!: HTMLElement;
	private editButton: HTMLButtonElement | null = null;
	private deleteButton: HTMLButtonElement | null = null;
	private footerElement: HTMLElement | null = null;

	constructor(options: ChatMessageComponentOptions) {
		const currentUserLogin = options.stateService.getCurrentUser()?.login;
		const isOutgoing = options.message.from === currentUserLogin;
		const messageClasses = [
			classes['message-item'],
			isOutgoing
				? classes['message-item--outgoing']
				: classes['message-item--incoming'],
		];

		super({
			tag: 'div',
			classes: messageClasses,
			attributes: { 'data-message-id': options.message.id },
		});

		this.messageData = {
			...options.message,
			status: { ...options.message.status },
		};
		this.onDeleteCallback = options.onDelete;
		this.onEditCallback = options.onEdit;
		this.isOutgoing = isOutgoing;

		this.render();
	}

	public updateMessage(newMessageData: MessageData): void {
		let needsRerender = false;
		if (this.messageData.text !== newMessageData.text) {
			this.messageData.text = newMessageData.text;
			this.textElement.textContent = newMessageData.text;
			needsRerender = true;
		}
		if (
			JSON.stringify(this.messageData.status) !==
			JSON.stringify(newMessageData.status)
		) {
			this.messageData.status = { ...newMessageData.status };
			needsRerender = true;
		}

		if (needsRerender) {
			this.renderFooter();
		}
	}

	public destroy(): void {
		this.editButton?.removeEventListener('click', this.handleEditClick);
		this.deleteButton?.removeEventListener('click', this.handleDeleteClick);
		super.destroy();
	}

	protected render(): void {
		const messageDate = new Date(this.messageData.datetime);
		const formattedTime = messageDate.toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
		const formattedDate = messageDate.toLocaleDateString([], {
			day: 'numeric',
			month: 'numeric',
			year: 'numeric',
		});

		const senderElement = ElementCreator.create({
			tag: 'div',
			classes: classes['message-sender'],
			content: this.isOutgoing ? 'You' : this.messageData.from,
		});
		const timeElement = ElementCreator.create({
			tag: 'div',
			classes: classes['message-time'],
			content: `${formattedDate},  ${formattedTime}`,
		});
		const headerElement = ElementCreator.create({
			tag: 'div',
			classes: classes['message-header'],
			children: [senderElement, timeElement],
		});

		this.textElement = ElementCreator.create({
			tag: 'div',
			classes: classes['message-text'],
			content: this.messageData.text,
		}) as HTMLElement;

		this.footerElement = ElementCreator.create({
			tag: 'div',
			classes: classes['message-footer'],
		}) as HTMLElement;
		this.renderFooter();

		this.appendChildren([
			headerElement,
			this.textElement,
			this.footerElement,
		]);
	}

	private renderFooter(): void {
		if (!this.footerElement) return;

		this.footerElement.innerHTML = '';
		this.statusElement = null;
		this.editedIndicatorElement = null;
		this.editButton = null;
		this.deleteButton = null;

		const footerChildren: HTMLElement[] = [];

		if (this.messageData.status.isEdited) {
			this.editedIndicatorElement = ElementCreator.create({
				tag: 'span',
				classes: classes['message-edited-indicator'],
				content: '(edited)',
				attributes: { title: 'This message was edited' },
			}) as HTMLElement;
			footerChildren.push(this.editedIndicatorElement);
		}

		if (this.isOutgoing) {
			let statusText = '';
			let statusClass = '';
			if (this.messageData.status.isReaded) {
				statusText = 'Read';
				statusClass = classes['message-status--read'] ?? '';
			} else if (this.messageData.status.isDelivered) {
				statusText = 'Delivered';
				statusClass = classes['message-status--delivered'] ?? '';
			}

			if (statusText) {
				this.statusElement = ElementCreator.create({
					tag: 'div',
					classes: [classes['message-status'], statusClass].filter(
						Boolean,
					),
					content: statusText,
				}) as HTMLElement;
				footerChildren.push(this.statusElement);
			}

			this.editButton = ElementCreator.create({
				tag: 'button',
				classes: [
					classes['message-action-button'],
					classes['edit-button'],
				],
				content: 'Edit',
				attributes: { type: 'button', title: 'Edit message' },
				on: { click: this.handleEditClick },
			}) as HTMLButtonElement;
			footerChildren.push(this.editButton);

			this.deleteButton = ElementCreator.create({
				tag: 'button',
				classes: [
					classes['message-action-button'],
					classes['delete-button'],
				],
				content: 'Delete',
				attributes: { type: 'button', title: 'Delete message' },
				on: { click: this.handleDeleteClick },
			}) as HTMLButtonElement;
			footerChildren.push(this.deleteButton);
		}

		if (footerChildren.length > 0) {
			this.footerElement.append(...footerChildren);
			this.footerElement.classList.remove(classes['hidden'] ?? '');
		} else {
			this.footerElement.classList.add(classes['hidden'] ?? '');
		}
	}

	private handleEditClick = (): void => {
		this.onEditCallback(this.messageData.id, this.messageData.text);
	};
	private handleDeleteClick = (): void => {
		if (confirm('Are you sure you want to delete this message?')) {
			this.onDeleteCallback(this.messageData.id);
		}
	};
}

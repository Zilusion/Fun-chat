import {
	BaseModalComponent,
	type BaseModalOptions,
} from '../base-modal/base-modal-component';
import type { EventBus } from '../../../services/event-bus';
import type { ConnectionStatus } from '../../../services/web-socket-service';

export class ConnectionStatusModalComponent extends BaseModalComponent {
	private readonly eventBus: EventBus;
	private currentStatus: ConnectionStatus | null = null;
	private unsubscribeFunctions: (() => void)[] = [];

	constructor(eventBus: EventBus) {
		const modalOptions: BaseModalOptions = {
			title: 'Connection Status',
			content: 'Connecting...',
			canClose: false,
			buttons: [],
		};
		super(modalOptions);
		this.eventBus = eventBus;
		this.subscribeToEvents();
	}

	public destroy(): void {
		this.unsubscribeFunctions.forEach((unsub) => unsub());
		this.unsubscribeFunctions = [];
		super.destroy();
	}

	public updateStatus(status: ConnectionStatus): void {
		if (this.currentStatus === status && status !== 'reconnecting') return;

		this.currentStatus = status;
		this.updateContent();

		if (
			(status === 'disconnected' || status === 'reconnecting') &&
			!this.element.open
		) {
			this.open();
		}
	}

	protected render(): void {
		super.render();
	}

	private subscribeToEvents(): void {
		const unsubscribeStatus = this.eventBus.subscribe(
			'websocket:status',
			(status) => {
				this.updateStatus(status);
			},
		);
		this.unsubscribeFunctions.push(unsubscribeStatus);

		const unsubscribeClose = this.eventBus.subscribe(
			'websocket:close',
			({ wasClean }) => {
				if (!wasClean) {
					this.currentStatus = 'disconnected';
					this.updateContent();
				}
			},
		);
		this.unsubscribeFunctions.push(unsubscribeClose);

		const unsubscribeOpen = this.eventBus.subscribe(
			'websocket:open',
			() => {
				this.close();
			},
		);
		this.unsubscribeFunctions.push(unsubscribeOpen);
	}

	private updateContent(): void {
		let title = 'Connection Status';
		let content = '';
		switch (this.currentStatus) {
			case 'connecting': {
				content = 'Connecting to server...';
				break;
			}
			case 'connected': {
				content = 'Connected!';
				break;
			}
			case 'disconnected': {
				title = 'Connection Lost';
				content = 'Connection lost. Attempting to reconnect...';
				break;
			}
			case 'reconnecting': {
				title = 'Reconnecting...';
				content = `Connection lost. Reconnecting...`;
				break;
			}
			default: {
				content = 'Unknown status';
				break;
			}
		}
		this.setTitle(title);
		this.setContent(content);
	}
}

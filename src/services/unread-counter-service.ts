import type { EventBus } from './event-bus';
import type { StateService } from './state-service';
import type { MessageService } from './message-service';
import type { UserInfo, MessageData } from '../types/api-types';

export class UnreadCounterService {
	private readonly eventBus: EventBus;
	private readonly stateService: StateService;
	private readonly messageService: MessageService;
	private isCounting = false;

	constructor(
		eventBus: EventBus,
		stateService: StateService,
		messageService: MessageService,
	) {
		this.eventBus = eventBus;
		this.stateService = stateService;
		this.messageService = messageService;
		this.subscribeToEvents();
		console.log('UnreadCounterService initialized');
	}

	private subscribeToEvents(): void {
		this.eventBus.subscribe('data:userListReceived', (allUsers) => {
			console.log(
				'UnreadCounterService: Received user list, calculating initial unread counts...',
			);
			if (this.stateService.getCurrentUser()) {
				this.calculateInitialUnreadCounts(allUsers);
			} else {
				console.log(
					'UnreadCounterService: User not logged in, skipping unread calculation.',
				);
			}
		});
	}

	private calculateInitialUnreadCounts(allUsers: UserInfo[]): void {
		if (this.isCounting) {
			console.warn(
				'UnreadCounterService: Calculation already in progress.',
			);
			return;
		}
		const currentUser = this.stateService.getCurrentUser();
		if (!currentUser) {
			console.error(
				'UnreadCounterService: Cannot count unread, current user is null.',
			);
			return;
		}
		this.isCounting = true;
		console.log(
			'UnreadCounterService: Starting initial unread count calculation by fetching all histories...',
		);

		const otherUsers = allUsers.filter(
			(u) => u.login !== currentUser.login,
		);
		const promises: Promise<{ userId: string; messages: MessageData[] }>[] =
			[];

		otherUsers.forEach((user) => {
			promises.push(
				this.messageService
					.fetchMessages(user.login)
					.then((messages) => ({ userId: user.login, messages }))
					.catch((error) => {
						console.error(
							`UnreadCounterService: Failed to fetch messages for ${user.login}:`,
							error,
						);
						return { userId: user.login, messages: [] };
					}),
			);
		});

		Promise.all(promises)
			.then((results) => {
				console.log(
					'UnreadCounterService: All message histories fetched (or failed). Calculating counts.',
				);
				const unreadCounts = new Map<string, number>();

				results.forEach(({ userId, messages }) => {
					let count = 0;
					messages.forEach((message) => {
						if (
							message.from === userId &&
							!message.status.isReaded
						) {
							count++;
						}
					});
					if (count > 0) {
						unreadCounts.set(userId, count);
					}
				});

				console.log(
					'UnreadCounterService: Calculation complete:',
					unreadCounts,
				);
				this.eventBus.publish(
					'data:initialUnreadCountsReceived',
					unreadCounts,
				);
			})
			.catch((error) => {
				console.error(
					'UnreadCounterService: Unexpected error during Promise.all for message fetching:',
					error,
				);
			})
			.finally(() => {
				this.isCounting = false;
			});
	}
}

import type { WebSocketService } from './web-socket-service';
import type { EventBus } from './event-bus';
import type { UserInfo } from '../types/api-types';

export class AuthService {
	private wsService: WebSocketService;
	private eventBus: EventBus;

	constructor(wsService: WebSocketService, eventBus: EventBus) {
		this.wsService = wsService;
		this.eventBus = eventBus;
	}

	public async login(login: string, password: string): Promise<UserInfo> {
		try {
			console.log(`AuthService: Attempting login for ${login}...`);
			const result = await this.wsService.send('USER_LOGIN', {
				user: { login, password },
			});
			const userInfo = result.user;
			console.log(`AuthService: Login successful for ${userInfo.login}`);
			try {
				// Сохраняем в sessionStorage (очищается при закрытии вкладки/браузера)
				sessionStorage.setItem('chatUserLogin', login); // Сохраняем логин
				sessionStorage.setItem('chatUserPassword', password); // Сохраняем пароль (!!!)
				console.log(
					'AuthService: Credentials saved to sessionStorage.',
				);
			} catch (storageError) {
				console.error(
					'AuthService: Failed to save credentials to sessionStorage:',
					storageError,
				);
				// Ошибка sessionStorage не должна прерывать логин
			}
			this.fetchAndPublishUsers().catch((error) => {
				console.error(
					'AuthService: Failed to fetch users after login:',
					error,
				);
				// Опционально: опубликовать событие ошибки загрузки пользователей
				// this.eventBus.publish('data:userListFailed', err);
			});
			this.eventBus.publish('auth:loginSuccess', userInfo);
			return userInfo;
		} catch (error) {
			console.error(`AuthService: Login failed for ${login}`, error);
			this.eventBus.publish(
				'auth:loginFailed',
				error instanceof Error
					? error
					: new Error(
							String(error?.toString() ?? 'Unknown login error'),
						),
			);
			throw error;
		}
	}

	public async logout(login: string, password: string): Promise<UserInfo> {
		try {
			console.log(`AuthService: Attempting logout for ${login}...`);
			const result = await this.wsService.send('USER_LOGOUT', {
				user: { login, password },
			});
			const userInfo = result.user;
			sessionStorage.removeItem('chatUserLogin');
			sessionStorage.removeItem('chatUserPassword');
			console.log(
				'AuthService: Credentials removed from sessionStorage.',
			);
			console.log(`AuthService: Logout successful for ${login}`);
			this.eventBus.publish('auth:logoutSuccess', userInfo);
			return userInfo;
		} catch (error) {
			console.error(`AuthService: Logout failed for ${login}`, error);
			this.eventBus.publish(
				'auth:logoutFailed',
				error instanceof Error
					? error
					: new Error(
							String(error?.toString() ?? 'Unknown logout error'),
						),
			);
			throw error;
		}
	}

	public async fetchAndPublishUsers(): Promise<void> {
		console.log('AuthService: Fetching user lists...');
		try {
			const [activeResult, inactiveResult] = await Promise.allSettled([
				this.wsService.send('USER_ACTIVE', null),
				this.wsService.send('USER_INACTIVE', null),
			]);

			const combinedUsers: UserInfo[] = [];

			if (activeResult.status === 'fulfilled') {
				combinedUsers.push(...activeResult.value.users);
			} else {
				console.error(
					'AuthService: Failed to fetch active users:',
					activeResult.reason,
				);
			}

			if (inactiveResult.status === 'fulfilled') {
				combinedUsers.push(...inactiveResult.value.users);
			} else {
				console.error(
					'AuthService: Failed to fetch inactive users:',
					inactiveResult.reason,
				);
			}

			console.log(
				`AuthService: User lists fetched. Total users: ${combinedUsers.length}`,
			);
			this.eventBus.publish('data:userListReceived', combinedUsers);
		} catch (error) {
			console.error(
				'AuthService: Unexpected error fetching user lists:',
				error,
			);
		}
	}

	public async refreshDataAfterReconnect(): Promise<void> {
		console.log('AuthService: Refreshing data after reconnect...');
		await this.fetchAndPublishUsers();
		// TODO: Позже сюда можно добавить логику запроса непрочитанных сообщений
		// или обновления истории текущего чата, если он был выбран.
		// Для этого может понадобиться MessageService.
		// await messageService.fetchUnreadCounts(); // Пример
	}
}

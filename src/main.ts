import './styles/main.scss';
import { AuthService } from './services/auth-service';
import { EventBus } from './services/event-bus';
import { StateService } from './services/state-service';
import { WebSocketService } from './services/web-socket-service';
import type { BaseComponent } from './components/base/component';
import { LoginPage } from './components/pages/login-page/login-page';
import { MainPage } from './components/pages/main-page/main-page';
import { AboutPage } from './components/pages/about-page/about-page';
import { Router } from './router/router';
import { MessageService } from './services/message-service';
import { ConnectionStatusModalComponent } from './components/modals/connection-modal/connection-modal-component';

const SERVER_URL = 'ws://127.0.0.1:4000/';

const eventBus = new EventBus();
const wsService = new WebSocketService(SERVER_URL, eventBus);
const authService = new AuthService(wsService, eventBus);
const messageService = new MessageService(wsService, eventBus);
const stateService = new StateService(eventBus);

let savedLogin: string | null = null;
let savedPassword: string | null = null;
let isInitialNavigationDone = false;
let isAutoLoginInProcess = false;

function readCredentialsFromStorage(): void {
	try {
		savedLogin = sessionStorage.getItem('chatUserLogin');
		savedPassword = sessionStorage.getItem('chatUserPassword');
		if (savedLogin && savedPassword) {
			console.log(
				`Found saved credentials for ${savedLogin} in sessionStorage.`,
			);
		} else {
			console.log('No saved credentials found in sessionStorage.');
		}
	} catch (error) {
		console.error('Failed to read credentials from sessionStorage:', error);
		savedLogin = null;
		savedPassword = null;
	}
}

const routes: Record<string, () => BaseComponent> = {
	'#/login': () => new LoginPage(authService, eventBus),
	'#/main': () => new MainPage(eventBus, stateService, messageService),
	'#/about': () => new AboutPage(),
};

const mainContentElement: HTMLElement = document.body;

const router = new Router(routes, mainContentElement, stateService, eventBus);

function runInitialNavigationIfReady(): void {
	if (isInitialNavigationDone) {
		console.log(
			'Initial navigation done, ensuring router state is consistent...',
		);
		router.handleNavigation();
	} else {
		if (isAutoLoginInProcess) {
			console.log(
				'Auto-login in progress, delaying initial navigation...',
			);
		} else {
			console.log('Running initial navigation...');
			isInitialNavigationDone = true;
			router.handleNavigation();
		}
	}
}

readCredentialsFromStorage();

const connectionModal = new ConnectionStatusModalComponent(eventBus);
mainContentElement.append(connectionModal.getElement());

eventBus.subscribe('auth:loginSuccess', (user) => {
	console.log(`>>> Login successful for ${user.login} (main.ts)`);
	isAutoLoginInProcess = false;
	isInitialNavigationDone = false;
	runInitialNavigationIfReady();
});

eventBus.subscribe('auth:loginFailed', (error) => {
	console.error(`>>> Login failed (main.ts):`, error.message);
	isAutoLoginInProcess = false;
	try {
		sessionStorage.removeItem('chatUserLogin');
		sessionStorage.removeItem('chatUserPassword');
	} catch (error_) {
		console.error('Failed to clear session storage on login fail:', error_);
	}
	savedLogin = null;
	savedPassword = null;
	stateService.resetStateOnLogout();
	isInitialNavigationDone = false;
	runInitialNavigationIfReady();
});

eventBus.subscribe('ui:logoutRequest', () => {
	console.log('>>> Logout requested from UI (main.ts)');
	const currentUser = stateService.getCurrentUser();
	let passwordFromStorage: string | null = null;

	try {
		passwordFromStorage = sessionStorage.getItem('chatUserPassword');
	} catch (error) {
		console.error('Failed to read password from sessionStorage:', error);
	}

	if (currentUser?.login && passwordFromStorage) {
		console.log(`Attempting logout for ${currentUser.login}...`);
		void authService.logout(currentUser.login, passwordFromStorage);
	} else if (currentUser?.login) {
		console.error('Cannot logout: Password not found in sessionStorage.');
		sessionStorage.removeItem('chatUserLogin');
		sessionStorage.removeItem('chatUserPassword');
		globalThis.location.hash = '#/login';
	} else {
		console.error('Cannot logout: Current user not found in state.');
		globalThis.location.hash = '#/login';
	}
});

eventBus.subscribe('websocket:open', () => {
	console.log('>>> WebSocket connection opened/re-established (main.ts)');
	readCredentialsFromStorage();
	connectionModal.close();

	if (savedLogin && savedPassword) {
		if (isAutoLoginInProcess) {
			console.log(
				'>>> Auto-login/re-authorization already in progress, skipping duplicate attempt.',
			);
		} else {
			console.log(
				`>>> Attempting re-authorization/auto-login for ${savedLogin}...`,
			);
			isAutoLoginInProcess = true;
			void authService.login(savedLogin, savedPassword).finally(() => {});
			savedPassword = null;
		}
	} else {
		console.log(
			'>>> No saved credentials found. Running initial navigation check...',
		);
		isInitialNavigationDone = false;
		runInitialNavigationIfReady();
	}
});

eventBus.subscribe('websocket:status', (status) => {
	connectionModal.updateStatus(status);
});

eventBus.subscribe('state:userListUpdated', (users) => {
	console.log('>>> User list updated (main.ts):', users.length, 'users');
});
eventBus.subscribe('state:currentMessagesUpdated', (messages) => {
	console.log(
		'>>> Current chat messages updated (main.ts):',
		messages.length,
		'messages',
	);
});
eventBus.subscribe('state:unreadCountsUpdated', (counts) => {
	console.log('>>> Unread counts updated (main.ts):', counts);
});
eventBus.subscribe('websocket:close', (payload) => {
	console.warn(
		`>>> WebSocket closed (main.ts): Code ${payload.code}, Clean: ${payload.wasClean}, Reason: ${payload.reason}`,
	);
	if (!payload.wasClean) {
		connectionModal.updateStatus('disconnected');
	}
});
eventBus.subscribe('websocket:error', (errorEvent) => {
	console.error('>>> WebSocket error occurred (main.ts):', errorEvent);
});

router.start();

globalThis.addEventListener('load', () => {
	console.log(
		'Window loaded. Waiting for WebSocket connection or auth result...',
	);
});

wsService.connect();

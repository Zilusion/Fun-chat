// src/main.ts
import './styles/main.scss';
import { AuthService } from './services/auth-service';
import { EventBus } from './services/event-bus';
import { StateService } from './services/state-service';
import { WebSocketService } from './services/web-socket-service';
// import { MessageService } from './services/message-service';
import type { BaseComponent } from './components/base/component';
import { LoginPage } from './components/pages/login-page/login-page';
import { MainPage } from './components/pages/main-page/main-page';
import { AboutPage } from './components/pages/about-page/about-page';
import { Router } from './router/router'; // <-- Импортируем Router

// --- Инициализация сервисов ---
const eventBus = new EventBus();
const wsService = new WebSocketService('ws://127.0.0.1:4000/', eventBus);
const stateService = new StateService(eventBus);
const authService = new AuthService(wsService, eventBus);
// const messageService = new MessageService(wsService);

let savedLogin: string | null = null;
let savedPassword: string | null = null;
let autoLoginAttempted = false;
let isInitialAuthCheckComplete = false;

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
	'#/main': () => new MainPage(authService, eventBus, stateService),
	'#/about': () => new AboutPage(),
};

const mainContentElement: HTMLElement = document.body;

const router = new Router(routes, mainContentElement, stateService, eventBus);

function runInitialNavigationIfReady(): void {
	if (!isInitialAuthCheckComplete) {
		console.log(
			'Initial auth check not complete yet, delaying navigation.',
		);
		return;
	}
	console.log('Initial auth check complete, running initial navigation...');
	router.handleNavigation();
}

readCredentialsFromStorage();

eventBus.subscribe('auth:loginSuccess', (user) => {
	console.log(`>>> Login successful for ${user.login} (main.ts)`);
	isInitialAuthCheckComplete = true;
	runInitialNavigationIfReady();
});

eventBus.subscribe('auth:loginFailed', (error) => {
	console.error(`>>> Login failed (main.ts):`, error.message);
	try {
		sessionStorage.removeItem('chatUserLogin');
		sessionStorage.removeItem('chatUserPassword');
	} catch (error_) {
		console.error('Failed to clear session storage on login fail:', error_);
	}
	savedLogin = null;
	savedPassword = null;
	autoLoginAttempted = true;
	isInitialAuthCheckComplete = true;
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
	const currentUser = stateService.getCurrentUser();

	if (currentUser) {
		console.log(
			`>>> User ${currentUser.login} was already logged in. Refreshing data...`,
		);
		void authService.refreshDataAfterReconnect();
		autoLoginAttempted = true;
		isInitialAuthCheckComplete = true;
		runInitialNavigationIfReady();
	} else if (savedLogin && savedPassword && !autoLoginAttempted) {
		console.log(`>>> Attempting auto-login for ${savedLogin}...`);
		autoLoginAttempted = true;
		void authService.login(savedLogin, savedPassword);
		savedPassword = null;
	} else {
		console.log('>>> Auto-login not needed or already attempted.');
		isInitialAuthCheckComplete = true;
		runInitialNavigationIfReady();
	}
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
});
eventBus.subscribe('websocket:error', (errorEvent) => {
	console.error('>>> WebSocket error occurred (main.ts):', errorEvent);
});

router.start();

globalThis.addEventListener('load', () => {
	console.log('Window loaded.');
	if (!savedLogin) {
		console.log(
			'No saved credentials, running initial navigation check on load.',
		);
		isInitialAuthCheckComplete = true;
		runInitialNavigationIfReady();
	}
});

wsService.connect();

// src/types/events.ts
import type { ConnectionStatus } from '../services/web-socket-service';
import type {
	UserInfo,
	MessageData,
	MessageDeliverPayload,
	MessageReadResponsePayload,
	MessageDeleteResponsePayload,
	MessageEditResponsePayload,
	UserExternalLoginPayload,
	UserExternalLogoutPayload,
	MessageSendResponsePayload,
} from './api-types';
import type { AppState } from './state';

export type EventPayloadMap = {
	// --- WebSocketService events ---
	'websocket:open': void;
	'websocket:close': { code: number; reason: string; wasClean: boolean };
	'websocket:error': Event;
	'websocket:status': ConnectionStatus;

	// --- Server notification events ---
	'server:userExternalLogin': UserExternalLoginPayload;
	'server:userExternalLogout': UserExternalLogoutPayload;
	'server:messageReceived': MessageSendResponsePayload;
	'server:messageDelivered': MessageDeliverPayload;
	'server:messageRead': MessageReadResponsePayload;
	'server:messageDeleted': MessageDeleteResponsePayload;
	'server:messageEdited': MessageEditResponsePayload;

	// --- Authentication events (from AuthService) ---
	'auth:loginSuccess': UserInfo;
	'auth:loginFailed': Error;
	'auth:logoutSuccess': UserInfo;
	'auth:logoutFailed': Error;

	// --- Data received event (from AuthService or other data services) ---
	'data:userListReceived': UserInfo[];

	// --- State change events (from StateService) ---
	'state:connectionStatusChanged': ConnectionStatus;
	'state:currentUserChanged': UserInfo | null;
	'state:userListUpdated': UserInfo[];
	'state:selectedChatChanged': string | null;

	'state:currentMessagesUpdated': MessageData[];
	'state:unreadCountsUpdated': Map<string, number>;

	// Optionally: general state change event for debugging
	'state:changed': Readonly<AppState>;

	// --- UI events ---
	'ui:loginRequest': { login: string; password: string };
	'ui:logoutRequest': void;
	'ui:selectChat': { userId: string };
	'ui:clearChatSelection': void;
};

export type AppEventType = keyof EventPayloadMap;

// src/types/state.ts
import type { ConnectionStatus } from '../services/web-socket-service';
import type { UserInfo, MessageData } from './api-types';

export type AppState = {
	connectionStatus: ConnectionStatus;
	currentUser: UserInfo | null;
	users: Map<string, UserInfo>;
	selectedChatUserId: string | null;
	currentChatMessages: MessageData[];
	unreadCounts: Map<string, number>;
	isLoadingUsers: boolean;
	isLoadingMessages: boolean;
};

export const getInitialAppState = (): AppState => ({
	connectionStatus: 'disconnected',
	currentUser: null,
	users: new Map<string, UserInfo>(),
	selectedChatUserId: null,
	currentChatMessages: [],
	unreadCounts: new Map<string, number>(),
	isLoadingUsers: false,
	isLoadingMessages: false,
});

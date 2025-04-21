import type {
	MessageDeliverPayload,
	UserExternalLoginPayload,
	UserExternalLogoutPayload,
} from './api-types';
import {
	type UserLoginPayload,
	type UserLogoutPayload,
	type UserLoginResponsePayload,
	type UserLogoutResponsePayload,
	type UserActiveResponsePayload,
	type UserInactiveResponsePayload,
	type UserInfo,
	type MessageDeletePayload,
	type MessageDeleteResponsePayload,
	type MessageEditPayload,
	type MessageEditResponsePayload,
	type MessageFromUserPayload,
	type MessageFromUserResponsePayload,
	type MessageReadPayload,
	type MessageReadResponsePayload,
	type MessageSendPayload,
	type MessageSendResponsePayload,
	isUserInfo,
} from './api-types';

export type RequestPayloadMap = {
	USER_LOGIN: UserLoginPayload;
	USER_LOGOUT: UserLogoutPayload;
	USER_ACTIVE: null;
	USER_INACTIVE: null;
	MSG_SEND: MessageSendPayload;
	MSG_FROM_USER: MessageFromUserPayload;
	MSG_READ: MessageReadPayload;
	MSG_DELETE: MessageDeletePayload;
	MSG_EDIT: MessageEditPayload;
};

export type ResponsePayloadMap = {
	USER_LOGIN: UserLoginResponsePayload;
	USER_LOGOUT: UserLogoutResponsePayload;
	USER_ACTIVE: UserActiveResponsePayload;
	USER_INACTIVE: UserInactiveResponsePayload;
	MSG_SEND: MessageSendResponsePayload;
	MSG_FROM_USER: MessageFromUserResponsePayload;
	MSG_READ: MessageReadResponsePayload;
	MSG_DELETE: MessageDeleteResponsePayload;
	MSG_EDIT: MessageEditResponsePayload;
};

export type ClientRequestType = keyof RequestPayloadMap;

export function isUserLoginResponsePayload(
	payload: unknown,
): payload is UserLoginResponsePayload {
	return (
		typeof payload === 'object' &&
		payload !== null &&
		'user' in payload &&
		typeof payload.user === 'object' &&
		payload.user !== null &&
		'login' in payload.user &&
		typeof payload.user.login === 'string' &&
		'isLogined' in payload.user &&
		typeof payload.user.isLogined === 'boolean'
	);
}

export function isUserLogoutResponsePayload(
	payload: unknown,
): payload is UserLogoutResponsePayload {
	return isUserLoginResponsePayload(payload);
}

export function isUserListPayload(
	payload: unknown,
): payload is { users: UserInfo[] } {
	return (
		typeof payload === 'object' &&
		payload !== null &&
		'users' in payload &&
		Array.isArray(payload.users) &&
		payload.users.every(isUserInfo)
	);
}

export function isUserActiveResponsePayload(
	payload: unknown,
): payload is UserActiveResponsePayload {
	return isUserListPayload(payload);
}

export function isUserInactiveResponsePayload(
	payload: unknown,
): payload is UserInactiveResponsePayload {
	return isUserListPayload(payload);
}

function isMessageDataBase(
	data: unknown,
): data is { id: string; text: string; datetime: number; status: object } {
	return (
		typeof data === 'object' &&
		data !== null &&
		'id' in data &&
		typeof data.id === 'string' &&
		'text' in data &&
		typeof data.text === 'string' &&
		'datetime' in data &&
		typeof data.datetime === 'number' &&
		'status' in data &&
		typeof data.status === 'object' &&
		data.status !== null
	);
}
function isMessageStatusBase(
	status: unknown,
): status is { isDelivered: boolean; isReaded: boolean; isEdited: boolean } {
	return (
		typeof status === 'object' &&
		status !== null &&
		'isDelivered' in status &&
		typeof status.isDelivered === 'boolean' &&
		'isReaded' in status &&
		typeof status.isReaded === 'boolean' &&
		'isEdited' in status &&
		typeof status.isEdited === 'boolean'
	);
}

export function isMessageSendResponsePayload(
	payload: unknown,
): payload is MessageSendResponsePayload {
	return (
		typeof payload === 'object' &&
		payload !== null &&
		'message' in payload &&
		typeof payload.message === 'object' &&
		payload.message !== null &&
		isMessageDataBase(payload.message) &&
		'from' in payload.message &&
		typeof payload.message.from === 'string' &&
		'to' in payload.message &&
		typeof payload.message.to === 'string' &&
		isMessageStatusBase(payload.message.status)
	);
}

export function isMessageFromUserResponsePayload(
	payload: unknown,
): payload is MessageFromUserResponsePayload {
	return (
		typeof payload === 'object' &&
		payload !== null &&
		'messages' in payload &&
		Array.isArray(payload.messages) &&
		payload.messages.every(
			(message) =>
				typeof message === 'object' &&
				message !== null &&
				isMessageDataBase(message) &&
				'from' in message &&
				typeof message.from === 'string' &&
				'to' in message &&
				typeof message.to === 'string' &&
				isMessageStatusBase(message.status),
		)
	);
}

export function isMessageReadResponsePayload(
	payload: unknown,
): payload is MessageReadResponsePayload {
	return (
		typeof payload === 'object' &&
		payload !== null &&
		'message' in payload &&
		typeof payload.message === 'object' &&
		payload.message !== null &&
		'id' in payload.message &&
		typeof payload.message.id === 'string' &&
		'status' in payload.message &&
		typeof payload.message.status === 'object' &&
		payload.message.status !== null &&
		'isReaded' in payload.message.status &&
		typeof payload.message.status.isReaded === 'boolean'
	);
}

export function isMessageDeleteResponsePayload(
	payload: unknown,
): payload is MessageDeleteResponsePayload {
	return (
		typeof payload === 'object' &&
		payload !== null &&
		'message' in payload &&
		typeof payload.message === 'object' &&
		payload.message !== null &&
		'id' in payload.message &&
		typeof payload.message.id === 'string' &&
		'status' in payload.message &&
		typeof payload.message.status === 'object' &&
		payload.message.status !== null &&
		'isDeleted' in payload.message.status &&
		typeof payload.message.status.isDeleted === 'boolean'
	);
}

export function isMessageEditResponsePayload(
	payload: unknown,
): payload is MessageEditResponsePayload {
	return (
		typeof payload === 'object' &&
		payload !== null &&
		'message' in payload &&
		typeof payload.message === 'object' &&
		payload.message !== null &&
		'id' in payload.message &&
		typeof payload.message.id === 'string' &&
		'text' in payload.message &&
		typeof payload.message.text === 'string' &&
		'status' in payload.message &&
		typeof payload.message.status === 'object' &&
		payload.message.status !== null &&
		'isEdited' in payload.message.status &&
		typeof payload.message.status.isEdited === 'boolean'
	);
}

export function isMessageDeliverPayload(
	payload: unknown,
): payload is MessageDeliverPayload {
	return (
		typeof payload === 'object' &&
		payload !== null &&
		'message' in payload &&
		typeof payload.message === 'object' &&
		payload.message !== null &&
		'id' in payload.message &&
		typeof payload.message.id === 'string' &&
		'status' in payload.message &&
		typeof payload.message.status === 'object' &&
		payload.message.status !== null &&
		'isDelivered' in payload.message.status &&
		typeof payload.message.status.isDelivered === 'boolean'
	);
}

export function isUserExternalLoginPayload(
	payload: unknown,
): payload is UserExternalLoginPayload {
	return isUserLoginResponsePayload(payload);
}

export function isUserExternalLogoutPayload(
	payload: unknown,
): payload is UserExternalLogoutPayload {
	return isUserLoginResponsePayload(payload);
}

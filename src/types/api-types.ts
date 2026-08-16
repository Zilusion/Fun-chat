export type BaseSocketMessage<T extends string, P> = {
	id: string | null;
	type: T;
	payload: P;
};

export type ErrorPayload = {
	error: string;
};

export type ErrorResponse = BaseSocketMessage<'ERROR', ErrorPayload>;

// Requests
// USER_LOGIN
export type UserLoginPayload = {
	user: {
		login: string;
		password: string;
	};
};

export type UserLoginRequest = BaseSocketMessage<
	'USER_LOGIN',
	UserLoginPayload
>;

// USER_LOGOUT
export type UserLogoutPayload = {
	user: {
		login: string;
		password: string;
	};
};

export type UserLogoutRequest = BaseSocketMessage<
	'USER_LOGOUT',
	UserLogoutPayload
>;

// USER_ACTIVE
export type UserActiveRequest = BaseSocketMessage<'USER_ACTIVE', null>;

// USER_INACTIVE
export type UserInactiveRequest = BaseSocketMessage<'USER_INACTIVE', null>;

// MSG_SEND
export type MessageSendPayload = {
	message: {
		to: string;
		text: string;
	};
};

export type MessageSendRequest = BaseSocketMessage<
	'MSG_SEND',
	MessageSendPayload
>;

// MSG_FROM_USER
export type MessageFromUserPayload = {
	user: {
		login: string;
	};
};

export type MessageFromUserRequest = BaseSocketMessage<
	'MSG_FROM_USER',
	MessageFromUserPayload
>;

// MSG_READ
export type MessageReadPayload = {
	message: {
		id: string;
	};
};

export type MessageReadRequest = BaseSocketMessage<
	'MSG_READ',
	MessageReadPayload
>;

// MSG_DELETE
export type MessageDeletePayload = {
	message: {
		id: string;
	};
};

export type MessageDeleteRequest = BaseSocketMessage<
	'MSG_DELETE',
	MessageDeletePayload
>;

// MSG_EDIT
export type MessageEditPayload = {
	message: {
		id: string;
		text: string;
	};
};

export type MessageEditRequest = BaseSocketMessage<
	'MSG_EDIT',
	MessageEditPayload
>;

// Responses
export type UserInfo = {
	login: string;
	isLogined: boolean;
};

// USER_LOGIN Response
export type UserLoginResponsePayload = {
	user: UserInfo;
};

export type UserLoginResponse = BaseSocketMessage<
	'USER_LOGIN',
	UserLoginResponsePayload
>;

// USER_LOGOUT Response
export type UserLogoutResponsePayload = {
	user: UserInfo;
};

export type UserLogoutResponse = BaseSocketMessage<
	'USER_LOGIN',
	UserLogoutResponsePayload
>;

// USER_ACTIVE Response
export type UserActiveResponsePayload = {
	users: UserInfo[];
};
export type UserActiveResponse = BaseSocketMessage<
	'USER_ACTIVE',
	UserActiveResponsePayload
>;

// USER_INACTIVE Response
export type UserInactiveResponsePayload = {
	users: UserInfo[];
};
export type UserInactiveResponse = BaseSocketMessage<
	'USER_INACTIVE',
	UserInactiveResponsePayload
>;

export type MessageStatus = {
	isDelivered: boolean;
	isReaded: boolean;
	isEdited: boolean;
};

export type MessageData = {
	id: string;
	from: string;
	to: string;
	text: string;
	datetime: number;
	status: MessageStatus;
};

// MSG_SEND Response
export type MessageSendResponsePayload = {
	message: MessageData;
};

export type MessageSendResponse = BaseSocketMessage<
	'MSG_SEND',
	MessageSendResponsePayload
>;

// MSG_FROM_USER Response
export type MessageFromUserResponsePayload = {
	messages: MessageData[];
};

export type MessageFromUserResponse = BaseSocketMessage<
	'MSG_FROM_USER',
	MessageFromUserResponsePayload
>;

// MSG_DELIVER Notification
export type MessageDeliverPayload = {
	message: {
		id: string;
		status: {
			isDelivered: boolean;
		};
	};
};

export type MessageDeliverNotification = BaseSocketMessage<
	'MSG_DELIVER',
	MessageDeliverPayload
>;

// MSG_READ Response
export type MessageReadResponsePayload = {
	message: {
		id: string;
		status: {
			isReaded: boolean;
		};
	};
};

export type MessageReadResponse = BaseSocketMessage<
	'MSG_READ',
	MessageReadResponsePayload
>;

// MSG_DELETE Response
export type MessageDeleteResponsePayload = {
	message: {
		id: string;
		status: {
			isDeleted: boolean;
		};
	};
};

export type MessageDeleteResponse = BaseSocketMessage<
	'MSG_DELETE',
	MessageDeleteResponsePayload
>;

// MSG_EDIT Response
export type MessageEditResponsePayload = {
	message: {
		id: string;
		text: string;
		status: {
			isEdited: boolean;
		};
	};
};
export type MessageEditResponse = BaseSocketMessage<
	'MSG_EDIT',
	MessageEditResponsePayload
>;

// USER_EXTERNAL_LOGIN
export type UserExternalLoginPayload = {
	user: UserInfo;
};

export type UserExternalLoginNotification = BaseSocketMessage<
	'USER_EXTERNAL_LOGIN',
	UserExternalLoginPayload
>;

// USER_EXTERNAL_LOGOUT
export type UserExternalLogoutPayload = {
	user: UserInfo;
};

export type UserExternalLogoutNotification = BaseSocketMessage<
	'USER_EXTERNAL_LOGOUT',
	UserExternalLogoutPayload
>;

// MSG_SEND
export type MessageSendNotification = BaseSocketMessage<
	'MSG_SEND',
	MessageSendResponsePayload
>;

// MSG_READ
export type MessageReadNotification = BaseSocketMessage<
	'MSG_READ',
	MessageReadResponsePayload
>;

// MSG_DELETE
export type MessageDeleteNotification = BaseSocketMessage<
	'MSG_DELETE',
	MessageDeleteResponsePayload
>;

// MSG_EDIT
export type MessageEditNotification = BaseSocketMessage<
	'MSG_EDIT',
	MessageEditResponsePayload
>;

export type ServerMessage =
	| ErrorResponse
	| UserLoginResponse
	| UserLogoutResponse
	| UserActiveResponse
	| UserInactiveResponse
	| MessageSendResponse
	| MessageFromUserResponse
	| MessageReadResponse
	| MessageDeleteResponse
	| MessageEditResponse
	| UserExternalLoginNotification
	| UserExternalLogoutNotification
	| MessageSendNotification
	| MessageDeliverNotification
	| MessageReadNotification
	| MessageDeleteNotification
	| MessageEditNotification;

// Type guards
export function isBaseSocketMessage(
	data: unknown,
): data is BaseSocketMessage<string, unknown> {
	return (
		typeof data === 'object' &&
		data !== null &&
		'id' in data &&
		(typeof data.id === 'string' || data.id === null) &&
		'type' in data &&
		typeof data.type === 'string' &&
		'payload' in data
	);
}

export function isErrorResponse(
	message: BaseSocketMessage<string, unknown>,
): message is ErrorResponse {
	return (
		message.type === 'ERROR' &&
		typeof message.payload === 'object' &&
		message.payload !== null &&
		'error' in message.payload &&
		typeof message.payload.error === 'string'
	);
}

export function isUserInfo(payload: unknown): payload is UserInfo {
	return (
		typeof payload === 'object' &&
		payload !== null &&
		'login' in payload &&
		typeof payload.login === 'string' &&
		'isLogined' in payload &&
		typeof payload.isLogined === 'boolean'
	);
}

export function isServerResponse(
	message: BaseSocketMessage<string, unknown>,
): message is BaseSocketMessage<string, unknown> & { id: string } {
	return typeof message.id === 'string';
}

export function isServerNotification(
	message: BaseSocketMessage<string, unknown>,
): message is BaseSocketMessage<string, unknown> & { id: null } {
	return message.id === null;
}

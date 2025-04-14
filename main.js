const socket = new WebSocket("ws://localhost:4000");

const form = document.forms[0];
const userId = crypto.randomUUID();
let login;
let password;

let chat = document.querySelector('#chat');
const getActiveUsersButton = document.querySelector("#get-active-users");
const getInactiveUsersButton = document.querySelector("#get-inactive-users");
const messageInput = document.querySelector('#message');
const sendMessageButton = document.querySelector('#send-message');

socket.addEventListener("open", () => console.log("Connected to server"));
socket.addEventListener("message", (event) => {
    const { data } = event;
    const response = JSON.parse(data);
    console.log(`Server response: ${data}`);

    if (response.type === "USER_LOGIN") {
        const { user } = response.payload;
        console.log(`User ${user.login} logged in`);
    }

    if (response.type === "USER_LOGOUT") {
        const { user } = response.payload;
        console.log(`User ${user.login} logged out`);
    }

    if (response.type === "USER_EXTERNAL_LOGIN") {
        const { user } = response.payload;
        console.log(`User ${user.login} logged in`);
    }

    if (response.type === "USER_EXTERNAL_LOGOUT") {
        const { user } = response.payload;
        console.log(`User ${user.login} logged out`);
    }

    if (response.type === "USER_ACTIVE") {
        const users = response.payload.users.map(user => user.login);
        console.log(`Active users: ${users.join(", ")}`);
    }

    if (response.type === "USER_INACTIVE") {
        const users = response.payload.users.map(user => user.login);
        console.log(`Inactive users: ${users.join(", ")}`);
    }
});

form.addEventListener("submit", (event) => {
    event.preventDefault();

    if (socket.readyState !== WebSocket.OPEN) {
        console.log("Socket is not open");
        return;
    }

    login = form.login.value;
    password = form.password.value;

    const request = {
        id: crypto.randomUUID(),
        type: "USER_LOGIN",
        payload: { user: { login, password } },
    };

    socket.send(JSON.stringify(request));
});

window.addEventListener("beforeunload", () => {
    if (!login || !password) {
        return;
    }
    const logout = {
        id: crypto.randomUUID(),
        type: "USER_LOGOUT",
        payload: { user: { login, password } },
    };
    socket.send(JSON.stringify(logout));
});

getActiveUsersButton.addEventListener("click", () => {
    const request = {
        id: crypto.randomUUID(),
        type: "USER_ACTIVE",
        payload: null,
    };
    socket.send(JSON.stringify(request));
});

getInactiveUsersButton.addEventListener("click", () => {
    const request = {
        id: crypto.randomUUID(),
        type: "USER_INACTIVE",
        payload: null,
    };
    socket.send(JSON.stringify(request));
});

sendMessageButton.addEventListener("click", () => {
    const message = messageInput.value;
    const request = {
        id: crypto.randomUUID(),
        type: "MSG_SEND",
        payload: { 
            message: {
                to: 1,
                text: message
            }
        },
    };
    socket.send(JSON.stringify(request));
});


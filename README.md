# Fun Chat

A real-time WebSocket chat built as an RS School JavaScript task. It includes authentication, active and inactive contact lists, message history, unread counters, and message editing, deletion, and read states.

**Stack:** TypeScript, Vite, SCSS, WebSocket API, client-side routing, ESLint, Stylelint.

- [Live demo](https://fun-chat.demo.sudorgin.com/)
- [RS School WebSocket server](https://github.com/rolling-scopes-school/fun-chat-server)

## Development

Start the RS School server on port `4000`, then run the client:

```bash
npm ci
npm run dev
```

Create a production build with `npm run build`. In production the client connects through the same-origin `/ws` endpoint.

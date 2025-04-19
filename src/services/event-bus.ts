import type { AppEventType, EventPayloadMap } from '../types/events';

type EventHandler<K extends AppEventType> = (data: EventPayloadMap[K]) => void;

export class EventBus {
	private events: Map<AppEventType, ((data: unknown) => void)[]> = new Map();

	public subscribe<K extends AppEventType>(
		eventType: K,
		handler: EventHandler<K>,
	): () => void {
		let handlers = this.events.get(eventType);
		if (!handlers) {
			handlers = [];
			this.events.set(eventType, handlers);
		}

		handlers.push(handler as (data: unknown) => void);

		return () => {
			this.unsubscribe(eventType, handler);
		};
	}

	public unsubscribe<K extends AppEventType>(
		eventType: K,
		handler: EventHandler<K>,
	): void {
		const handlers = this.events.get(eventType);
		if (handlers) {
			const newHandlers = handlers.filter(
				(h) => h !== (handler as (data: unknown) => void),
			);
			if (newHandlers.length !== handlers.length) {
				this.events.set(eventType, newHandlers);
			}
		}
	}

	public publish<K extends AppEventType>(
		eventType: K,
		data?: EventPayloadMap[K],
	): void {
		const handlers = this.events.get(eventType);
		if (handlers) {
			handlers.forEach((handler) => {
				try {
					handler(data);
				} catch (error) {
					console.error(
						`EventBus: Error in handler for event "${eventType}":`,
						error,
					);
				}
			});
		}
	}
}

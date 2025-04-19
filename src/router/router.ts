// src/router/router.ts
import type { BaseComponent } from '../components/base/component';
import type { StateService } from '../services/state-service';
import type { EventBus } from '../services/event-bus';
import type { UserInfo } from '../types/api-types';

type ComponentFactory = () => BaseComponent;

export class Router {
	private readonly routes: Record<string, ComponentFactory>;
	private readonly mainContentElement: HTMLElement;
	private readonly stateService: StateService;
	private readonly eventBus: EventBus;

	private pageCache: Map<string, BaseComponent> = new Map();
	private currentDomComponent: BaseComponent | null = null;
	private isNavigating = false;

	constructor(
		routes: Record<string, ComponentFactory>,
		mainContentElement: HTMLElement,
		stateService: StateService,
		eventBus: EventBus,
	) {
		this.routes = routes;
		this.mainContentElement = mainContentElement;
		this.stateService = stateService;
		this.eventBus = eventBus;
		console.log('Router: Initialized');
	}

	public start(): void {
		console.log('Router: Starting...');
		globalThis.addEventListener(
			'hashchange',
			this.handleNavigation.bind(this),
		);

		this.eventBus.subscribe('auth:logoutSuccess', () => {
			console.log('Router: Handling auth:logoutSuccess...');
			this.clearCacheAndNavigateToLogin();
		});

		console.log('Router: Event listeners attached.');
	}

	public navigateTo(hash: string): void {
		if (globalThis.location.hash === hash) {
			console.log(
				`Router: Hash is already ${hash}, forcing navigation check.`,
			);
			this.handleNavigation();
		} else {
			console.log(`Router: Programmatically navigating to ${hash}`);
			globalThis.location.hash = hash;
		}
	}

	public handleNavigation(): void {
		if (this.isNavigating) {
			console.warn('Router: Navigation already in progress, skipping.');
			return;
		}
		this.isNavigating = true;

		const hash = globalThis.location.hash || '#/login';
		const targetRoute = hash.split('?')[0];

		console.log(`Router: Handling navigation to: ${targetRoute}`);

		const currentUser = this.stateService.getCurrentUser();

		if (this.needsRedirect(targetRoute, currentUser)) {
			this.isNavigating = false;
			return;
		}

		const componentFactory = this.routes[targetRoute];

		if (!componentFactory) {
			console.error(
				`Router: Route ${targetRoute} not found, redirecting to #/login`,
			);
			this.navigateTo('#/login');
			this.isNavigating = false;
			return;
		}

		let targetComponentInstance: BaseComponent | null = null;
		try {
			targetComponentInstance = this.getComponentInstance(
				targetRoute,
				componentFactory,
			);
		} catch (error) {
			console.error(
				`Router: Failed to get/create component for ${targetRoute}, redirecting.`,
				error,
			);
			this.clearComponentCache(targetRoute);
			this.navigateTo('#/login');
			this.isNavigating = false;
			return;
		}

		if (!targetComponentInstance) {
			console.error(
				'Router: Target component instance is null after get/create, redirecting.',
			);
			this.navigateTo('#/login');
			this.isNavigating = false;
			return;
		}

		this.renderComponent(targetComponentInstance);

		this.isNavigating = false;
		console.log(`Router: Navigation to ${targetRoute} complete.`);
	}

	private needsRedirect(
		targetRoute: string,
		currentUser: UserInfo | null,
	): boolean {
		const isLoginPage = targetRoute === '#/login';
		const isMainPage = targetRoute === '#/main';

		if (isLoginPage && currentUser) {
			console.log(
				'Router: User logged in, redirecting from /login to /main',
			);
			this.navigateTo('#/main');
			return true;
		}

		if (isMainPage && !currentUser) {
			console.log(
				'Router: User not logged in, redirecting from /main to /login',
			);
			this.navigateTo('#/login');
			return true;
		}

		return false;
	}

	private getComponentInstance(
		route: string,
		factory: ComponentFactory,
	): BaseComponent {
		if (this.pageCache.has(route)) {
			console.log(`Router: Using cached component instance for ${route}`);
			return this.pageCache.get(route)!;
		}
		console.log(`Router: Creating new component instance for ${route}`);
		const instance = factory();
		this.pageCache.set(route, instance);
		return instance;
	}

	private renderComponent(targetComponentInstance: BaseComponent): void {
		if (this.currentDomComponent === targetComponentInstance) {
			return;
		}

		if (this.currentDomComponent) {
			try {
				this.currentDomComponent.getElement().remove();
			} catch (error) {
				console.error(
					'Router: Error removing previous component:',
					error,
				);
			}
		}

		try {
			this.mainContentElement.append(
				targetComponentInstance.getElement(),
			);
			this.currentDomComponent = targetComponentInstance;
		} catch (error) {
			console.error('Router: Error appending target component:', error);
			if (this.currentDomComponent === targetComponentInstance) {
				this.currentDomComponent = null;
			}
		}
	}

	private clearCacheAndNavigateToLogin(): void {
		console.log('Router: Clearing all pages and navigating to login...');
		this.pageCache.forEach((component, route) => {
			console.log(
				`Router: Destroying instance and removing element for route: ${route}`,
			);
			component.destroy();
			try {
				if (
					component.getElement().parentElement ===
					this.mainContentElement
				) {
					component.getElement().remove();
				}
			} catch (error) {
				console.error(
					`Router: Error removing element for route ${route}:`,
					error,
				);
			}
		});
		this.pageCache.clear();
		this.currentDomComponent = null;
		this.navigateTo('#/login');
	}

	private clearComponentCache(route: string): void {
		if (this.pageCache.has(route)) {
			const component = this.pageCache.get(route);
			component?.destroy();
			this.pageCache.delete(route);
			console.log(`Router: Cleared cache for route ${route}`);
		}
	}
}

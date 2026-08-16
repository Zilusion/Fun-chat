// src/components/base/component.ts
import ElementCreator from '../../utils/element-creator';
import type { ElementParameters } from '../../utils/element-creator';

type BaseComponentParameters = ElementParameters;

export abstract class BaseComponent<T extends HTMLElement = HTMLElement> {
	protected readonly element: T;

	constructor(options: BaseComponentParameters) {
		this.element = ElementCreator.create(options) as T;
	}

	public getElement(): T {
		return this.element;
	}

	public destroy(): void {
		console.log(`Destroying component: ${this.constructor.name}`);
	}

	public addClass(className: string): void {
		this.element.classList.add(className);
	}
	public removeClass(className: string): void {
		this.element.classList.remove(className);
	}
	public toggleClass(className: string, force?: boolean): void {
		this.element.classList.toggle(className, force);
	}

	protected render(): void {}

	protected appendChildren(
		children: (
			| BaseComponent<HTMLElement>
			| HTMLElement
			| Element
			| ElementCreator
			| ElementParameters
		)[],
	): void {
		children.forEach((child) => {
			let childElement: Element | null = null;
			if (child instanceof BaseComponent) {
				childElement = child.getElement();
			} else if (child instanceof Element) {
				childElement = child;
			} else if (child instanceof ElementCreator) {
				childElement = child.getElement();
			} else if (
				typeof child === 'object' &&
				child !== null &&
				'tag' in child
			) {
				childElement = ElementCreator.create(child);
			} else {
				console.warn(
					'BaseComponent.appendChildren received an invalid child type:',
					child,
				);
			}
			if (childElement) {
				this.element.append(childElement);
			}
		});
	}
}

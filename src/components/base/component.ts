import ElementCreator from '../../utils/element-creator';
import type { ElementParameters } from '../../utils/element-creator';

export abstract class BaseComponent {
	// Корневой элемент компонента. protected - доступен наследникам.
	// HTMLElement для простоты, можно сделать Element, если нужны SVG и т.д.
	protected readonly element: HTMLElement;

	/**
	 * Конструктор базового компонента.
	 * Вызывает метод `createView` для создания DOM-структуры.
	 * @param {Partial<ElementParameters> | undefined} options - Опциональные параметры для корневого элемента (tag, classes).
	 *                                                             По умолчанию создается 'div'.
	 */
	constructor(options?: Partial<Pick<ElementParameters, 'tag' | 'classes'>>) {
		// Вызываем абстрактный метод, который ДОЛЖЕН быть реализован в наследнике.
		// Этот метод вернет корневой элемент компонента.
		this.element = this.createView(options);
	}

	/**
	 * Возвращает корневой DOM-элемент компонента.
	 * @returns {HTMLElement} Корневой элемент.
	 */
	public getElement(): HTMLElement {
		return this.element;
	}

	/**
	 * Метод для добавления дочерних компонентов или элементов.
	 * Делегирует вызов `append` корневому элементу.
	 * @param {(BaseComponent | HTMLElement | ElementCreator | ElementParameters)[]} children - Дочерние элементы/компоненты.
	 */
	public appendChildren(
		children: (
			| BaseComponent
			| HTMLElement
			| ElementCreator
			| ElementParameters
		)[],
	): void {
		children.forEach((child) => {
			if (child instanceof BaseComponent) {
				this.element.append(child.getElement());
			} else if (child instanceof HTMLElement) {
				this.element.append(child);
			} else if (child instanceof ElementCreator) {
				// Если вдруг передали экземпляр ElementCreator
				this.element.append(child.getElement());
			} else {
				// Если передали параметры для ElementCreator
				this.element.append(ElementCreator.create(child));
			}
		});
	}

	/**
	 * Метод для очистки ресурсов компонента (слушатели событий, подписки).
	 * Дочерние компоненты ДОЛЖНЫ переопределить этот метод, если им нужна очистка,
	 * и вызвать `super.destroy()` в конце своей реализации.
	 */
	public destroy(): void {
		// Базовая реализация может быть пустой или удалять сам элемент,
		// но лучше оставить удаление на усмотрение родительского компонента/роутера.
		// Основная задача здесь - отписаться от событий EventBus и удалить DOM-слушатели, добавленные компонентом.
		console.log(`Destroying component: ${this.constructor.name}`);
		// Удаление элемента из DOM не входит в базовую логику destroy,
		// так как это решает тот, кто добавил элемент.
		// this.element.remove(); // <-- Не делайте этого здесь по умолчанию
	}

	// Можно добавить другие общие методы, если они нужны всем компонентам,
	// например, для добавления/удаления классов корневому элементу.
	public addClass(className: string): void {
		this.element.classList.add(className);
	}

	public removeClass(className: string): void {
		this.element.classList.remove(className);
	}

	public toggleClass(className: string, force?: boolean): void {
		this.element.classList.toggle(className, force);
	}

	/**
	 * Абстрактный метод, который должен быть реализован в дочерних компонентах.
	 * Отвечает за создание и возврат корневого DOM-элемента компонента.
	 * Может использовать ElementCreator или стандартные DOM API.
	 * @param {Partial<ElementParameters> | undefined} options - Опциональные параметры, переданные из конструктора.
	 * @returns {HTMLElement} Корневой элемент компонента.
	 */
	protected abstract createView(
		options?: Partial<Pick<ElementParameters, 'tag' | 'classes'>>,
	): HTMLElement;
}

// Тип для параметров, которые может принимать компонент в конструкторе
// (помимо стандартных опций базового компонента)
export type ComponentOptions<T = object> = T & {
	// Можно добавить общие опции для всех компонентов, если нужно
};

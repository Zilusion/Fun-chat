import { BaseComponent } from '../../base/component';
import ElementCreator from '../../../utils/element-creator';
import classes from './_base-modal-component.module.scss';

export type ModalButtonConfig = {
	text: string;
	style?: 'primary' | 'secondary' | 'danger' | 'default';
	onClick: (
		event: MouseEvent,
		modal: BaseModalComponent,
	) => void | Promise<void>;
	closeOnClick?: boolean;
};

export type BaseModalOptions = {
	title?: string;
	content?: string | HTMLElement | BaseComponent;
	buttons?: ModalButtonConfig[];
	canClose?: boolean;
	onClose?: () => void;
};

export class BaseModalComponent extends BaseComponent<HTMLDialogElement> {
	protected readonly options: BaseModalOptions;
	protected headerElement: HTMLElement | null = null;
	protected titleElement: HTMLElement | null = null;
	protected bodyElement: HTMLElement | null = null;
	protected footerElement: HTMLElement | null = null;
	protected closeButton: HTMLButtonElement | null = null;

	constructor(options: BaseModalOptions = {}) {
		super({
			tag: 'dialog',
			classes: [classes['modal']],
		});
		this.options = options;

		this.render();

		this.element.addEventListener('close', this.handleDialogClose);
		if (this.options.canClose !== false) {
			this.element.addEventListener('click', this.handleBackdropClick);
		}
	}

	public destroy(): void {
		this.element.removeEventListener('close', this.handleDialogClose);
		this.element.removeEventListener('click', this.handleBackdropClick);
		this.element.remove();
		super.destroy();
	}

	public setContent(content: string | HTMLElement | BaseComponent): void {
		if (!this.bodyElement) return;
		this.bodyElement.innerHTML = '';
		if (typeof content === 'string') {
			this.bodyElement.textContent = content;
		} else if (content instanceof BaseComponent) {
			this.bodyElement.append(content.getElement());
		} else if (content instanceof HTMLElement) {
			this.bodyElement.append(content);
		}
	}

	public setTitle(title: string): void {
		if (this.titleElement) {
			this.titleElement.textContent = title;
		}
	}

	public open(): void {
		if (!this.element.isConnected) {
			document.body.append(this.element);
		}
		this.element.showModal();
		console.log(`Modal opened: ${this.constructor.name}`);
	}

	public close(): void {
		this.element.close();
	}

	protected render(): void {
		console.log('BaseModal rendering structure...');
		this.headerElement = ElementCreator.create({
			tag: 'header',
			classes: classes['modal-header'],
		}) as HTMLElement;
		this.titleElement = ElementCreator.create({
			tag: 'h2',
			classes: classes['modal-title'],
			content: this.options.title ?? '',
		}) as HTMLElement;
		if (this.options.canClose === false) {
			this.headerElement.append(this.titleElement);
		} else {
			this.closeButton = ElementCreator.create({
				tag: 'button',
				classes: classes['modal-close-button'],
				content: '×',
				attributes: { type: 'button', 'aria-label': 'Close dialog' },
				on: { click: () => this.close() },
			}) as HTMLButtonElement;
			this.headerElement.append(this.titleElement, this.closeButton);
		}

		this.bodyElement = ElementCreator.create({
			tag: 'div',
			classes: classes['modal-body'],
		}) as HTMLElement;
		this.setContent(this.options.content ?? '');

		this.footerElement = ElementCreator.create({
			tag: 'footer',
			classes: classes['modal-footer'],
		}) as HTMLElement;
		this.renderButtons();

		this.appendChildren([
			this.headerElement,
			this.bodyElement,
			this.footerElement,
		]);
	}

	protected renderButtons(): void {
		if (!this.footerElement) return;
		this.footerElement.innerHTML = '';
		if (this.options.buttons && this.options.buttons.length > 0) {
			this.options.buttons.forEach((config) => {
				const buttonClasses = ['button'];
				switch (config.style) {
					case 'primary': {
						buttonClasses.push(classes['button-primary'] ?? '');
						break;
					}
					case 'danger': {
						buttonClasses.push(classes['button-danger'] ?? '');
						break;
					}
					case 'secondary': {
						buttonClasses.push(
							'button--outline',
							classes['button-secondary'] ?? '',
						);
						break;
					}
					default: {
						buttonClasses.push('button--outline');
						break;
					}
				}

				const button = ElementCreator.create({
					tag: 'button',
					classes: buttonClasses.filter(Boolean),
					content: config.text,
					attributes: { type: 'button' },
					on: {
						click: (event: Event) => {
							void (async (): Promise<void> => {
								if (!(event instanceof MouseEvent)) {
									console.error(
										'Modal button click handler received non-MouseEvent:',
										event,
									);
									return;
								}
								try {
									await config.onClick(event, this);
								} catch (error) {
									console.error(
										'Error in modal button onClick handler:',
										error,
									);
								}
								if (config.closeOnClick !== false) {
									this.close();
								}
							})();
						},
					},
				}) as HTMLButtonElement;
				this.footerElement!.append(button);
			});
		} else {
			this.footerElement.classList.add(classes['hidden'] ?? 'hidden');
		}
	}

	private handleDialogClose = (): void => {
		console.log(`Modal closed: ${this.constructor.name}`);
		this.options.onClose?.();
		this.destroy();
	};

	private handleBackdropClick = (event: MouseEvent): void => {
		const rect = this.element.getBoundingClientRect();
		const isInDialog =
			rect.top <= event.clientY &&
			event.clientY <= rect.top + rect.height &&
			rect.left <= event.clientX &&
			event.clientX <= rect.left + rect.width;
		if (!isInDialog) {
			this.close();
		}
	};
}

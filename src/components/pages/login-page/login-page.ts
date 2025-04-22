import type { AuthService } from '../../../services/auth-service';
import type { EventBus } from '../../../services/event-bus';

import ElementCreator from '../../../utils/element-creator';
import { BaseComponent } from '../../base/component';
import { AboutButtonComponent } from '../../buttons/about-button/about-button-component';

import classes from './_login-page.module.scss';

type FieldValidationState = {
	isValid: boolean;
	message: string;
	interacted: boolean;
};

export class LoginPage extends BaseComponent {
	private readonly authService: AuthService;
	private readonly eventBus: EventBus;

	private container: HTMLElement | null = null;
	private loginForm: HTMLFormElement | null = null;
	private fieldSet: HTMLFieldSetElement | null = null;
	private legend: HTMLLegendElement | null = null;
	private usernameFieldContainer: HTMLElement | null = null;
	private usernameLabel: HTMLLabelElement | null = null;
	private usernameInput: HTMLInputElement | null = null;
	private passwordFieldContainer: HTMLElement | null = null;
	private passwordLabel: HTMLLabelElement | null = null;
	private passwordInput: HTMLInputElement | null = null;
	private loginButton: HTMLButtonElement | null = null;
	private infoButton: AboutButtonComponent | null = null;
	private errorElement: HTMLElement | null = null;

	private unsubscribeFunctions: (() => void)[] = [];

	private validationState: {
		username: FieldValidationState;
		password: FieldValidationState;
	} = {
		username: { isValid: false, message: '', interacted: false },
		password: { isValid: false, message: '', interacted: false },
	};

	constructor(authService: AuthService, eventBus: EventBus) {
		super({
			tag: 'main',
			classes: classes['page'],
		});

		this.authService = authService;
		this.eventBus = eventBus;

		this.render();

		this.addEventListeners();
		this.subscribeToEvents();
		this.updateSubmitButtonState();
	}

	public destroy(): void {
		console.log('Destroying LoginPage component');
		this.loginForm?.removeEventListener('submit', () => this.handleSubmit);
		this.infoButton?.destroy();
		this.usernameInput?.removeEventListener(
			'input',
			this.handleUsernameInput,
		);
		this.passwordInput?.removeEventListener(
			'input',
			this.handlePasswordInput,
		);

		this.unsubscribeFunctions.forEach((unsubscribe) => unsubscribe());
		this.unsubscribeFunctions = [];

		super.destroy();
	}

	protected render(): void {
		this.container = ElementCreator.create({
			tag: 'div',
			classes: ['container', classes['container']],
		}) as HTMLElement;

		this.loginForm = ElementCreator.create({
			tag: 'form',
			classes: classes['form'],
			attributes: {
				id: 'login-form',
				autocomplete: 'on',
				novalidate: '',
			},
		}) as HTMLFormElement;

		this.fieldSet = ElementCreator.create({
			tag: 'fieldset',
			classes: classes['fieldset'],
		}) as HTMLFieldSetElement;

		this.legend = ElementCreator.create({
			tag: 'legend',
			classes: classes['legend'],
			content: 'Log in / Sign up',
		}) as HTMLLegendElement;

		this.usernameFieldContainer = ElementCreator.create({
			tag: 'div',
			classes: classes['field-container'],
		}) as HTMLElement;
		this.usernameLabel = ElementCreator.create({
			tag: 'label',
			classes: classes['label'],
			attributes: { for: 'username' },
			content: 'Username',
		}) as HTMLLabelElement;
		this.usernameInput = ElementCreator.create({
			tag: 'input',
			classes: classes['input'],
			attributes: {
				type: 'text',
				id: 'username',
				name: 'username',
				placeholder: 'Enter username',
				required: '',
				autocomplete: 'on',
				pattern: String.raw`^\S+$`,
			},
		}) as HTMLInputElement;
		this.usernameFieldContainer.append(
			this.usernameLabel,
			this.usernameInput,
		);

		this.passwordFieldContainer = ElementCreator.create({
			tag: 'div',
			classes: classes['field-container'],
		}) as HTMLElement;
		this.passwordLabel = ElementCreator.create({
			tag: 'label',
			classes: classes['label'],
			attributes: { for: 'password' },
			content: 'Password',
		}) as HTMLLabelElement;
		this.passwordInput = ElementCreator.create({
			tag: 'input',
			classes: classes['input'],
			attributes: {
				type: 'password',
				id: 'password',
				name: 'password',
				placeholder: 'Enter password',
				required: '',
				pattern: String.raw`^\S+$`,
			},
		}) as HTMLInputElement;
		this.passwordFieldContainer.append(
			this.passwordLabel,
			this.passwordInput,
		);

		this.errorElement = ElementCreator.create({
			tag: 'div',
			classes: [classes['error-message'], 'hidden'],
		}) as HTMLElement;

		this.loginButton = ElementCreator.create({
			tag: 'button',
			classes: ['button', classes['login-button']],
			content: 'Log in',
			attributes: { type: 'submit' },
		}) as HTMLButtonElement;
		this.infoButton = new AboutButtonComponent();

		this.fieldSet.append(
			this.legend,
			this.usernameFieldContainer,
			this.passwordFieldContainer,
			this.errorElement,
		);
		this.loginForm.append(
			this.fieldSet,
			this.loginButton,
			this.infoButton.getElement(),
		);
		this.container.append(this.loginForm);
		this.element.append(this.container);
	}

	private addEventListeners(): void {
		this.loginForm?.addEventListener('submit', this.handleSubmit);
		this.usernameInput?.addEventListener('input', this.handleUsernameInput);
		this.passwordInput?.addEventListener('input', this.handlePasswordInput);

		this.updateSubmitButtonState();
	}

	private subscribeToEvents(): void {
		const unsubscribeLoginFailed = this.eventBus.subscribe(
			'auth:loginFailed',
			(error) => {
				this.showError(error.message);
				this.setLoadingState(false);
			},
		);
		this.unsubscribeFunctions.push(unsubscribeLoginFailed);
	}

	private handleUsernameInput = (): void => {
		this.validationState.username.interacted = true;
		this.validateField('username');
		this.validateField('password');
		this.updateUIOnValidation();
	};

	private handlePasswordInput = (): void => {
		this.validationState.password.interacted = true;
		this.validateField('password');
		this.validateField('username');
		this.updateUIOnValidation();
	};

	private updateUIOnValidation(): void {
		this.updateErrorMessage();
		this.updateSubmitButtonState();
	}

	private handleSubmit = (event: SubmitEvent): void => {
		event.preventDefault();
		const isFormValid = this.validateAllFields();

		if (!isFormValid) {
			console.warn(
				'Login form submission prevented due to validation errors.',
			);
			return;
		}

		void (async (): Promise<void> => {
			const username = this.usernameInput?.value.trim();
			const password = this.passwordInput?.value.trim();

			if (username && password) {
				this.showError('');
				this.setLoadingState(true);
				try {
					await this.authService.login(username, password);
				} catch {
					this.setLoadingState(false);
				}
			}
		})();
	};

	private validateField(
		fieldName: keyof typeof this.validationState,
	): boolean {
		const state = this.validationState[fieldName];
		const inputElement =
			fieldName === 'username' ? this.usernameInput : this.passwordInput;
		const value = inputElement?.value.trim() ?? '';
		const originalValue = inputElement?.value ?? '';

		let isValid = false;
		let message = '';

		if (fieldName === 'username') {
			if (/\s/.test(originalValue))
				message = 'Username must not contain spaces.';
			else if (!value) message = 'Username must not be empty.';
			else if (value.length < 3)
				message = 'Username must contain at least 3 characters.';
			else if (value.length > 20)
				message = 'Username must not contain more than 20 characters.';
			else if (/^[\dA-Za-z]+$/.test(value)) {
				isValid = true;
			} else {
				message =
					'Username may only contain Latin letters and numbers.';
			}
		} else if (fieldName === 'password') {
			const usernameValue = this.usernameInput?.value.trim() ?? '';
			if (/\s/.test(originalValue))
				message = 'Password must not contain spaces.';
			else if (!value) message = 'Password must not be empty.';
			else if (value.length < 6)
				message = 'Password must contain at least 6 characters.';
			else if (!/[a-z]/.test(value))
				message =
					'Password must contain at least one lowercase letter.';
			else if (!/[A-Z]/.test(value))
				message =
					'Password must contain at least one uppercase letter.';
			else if (!/\d/.test(value))
				message = 'Password must contain at least one number.';
			else if (value === usernameValue && usernameValue.length > 0)
				message = 'Password must not match username.';
			else isValid = true;
		}

		state.isValid = isValid;
		state.message = message;

		inputElement?.classList.toggle(
			classes['input--error'],
			!isValid && state.interacted,
		);

		return isValid;
	}

	private validateAllFields(): boolean {
		this.validationState.username.interacted = true;
		this.validationState.password.interacted = true;

		const isUsernameValid = this.validateField('username');
		const isPasswordValid = this.validateField('password');
		const isValid = isUsernameValid && isPasswordValid;

		this.updateErrorMessage();
		this.updateSubmitButtonState();

		return isValid;
	}

	private updateErrorMessage(): void {
		let messageToShow = '';
		if (
			!this.validationState.username.isValid &&
			this.validationState.username.interacted
		) {
			messageToShow = this.validationState.username.message;
		} else if (
			!this.validationState.password.isValid &&
			this.validationState.password.interacted
		) {
			messageToShow = this.validationState.password.message;
		}
		this.showError(messageToShow);
	}

	private updateSubmitButtonState(): void {
		const isFormCurrentlyValid =
			this.validationState.username.isValid &&
			this.validationState.password.isValid;
		if (this.loginButton) {
			const isLoading = this.loginButton.classList.contains(
				classes['button--loading'],
			);
			this.loginButton.disabled = !isFormCurrentlyValid || isLoading;
		}
	}

	private showError(message: string): void {
		if (this.errorElement) {
			this.errorElement.textContent = message;
			this.errorElement.classList.toggle('hidden', !message);
		}
	}

	private setLoadingState(isLoading: boolean): void {
		this.usernameInput?.toggleAttribute('disabled', isLoading);
		this.passwordInput?.toggleAttribute('disabled', isLoading);

		this.loginButton?.classList.toggle(
			classes['button--loading'],
			isLoading,
		);
		if (this.loginButton) {
			this.loginButton.textContent = isLoading
				? 'Logging in...'
				: 'Log in';
		}
		this.updateSubmitButtonState();
	}
}

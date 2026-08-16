import {
	BaseModalComponent,
	type BaseModalOptions,
} from '../base-modal/base-modal-component';

export type ConfirmModalOptions = Pick<
	BaseModalOptions,
	'title' | 'content'
> & {
	confirmText?: string;
	cancelText?: string;
	onConfirm: () => void | Promise<void>;
	onCancel?: () => void;
};

export class ConfirmModalComponent extends BaseModalComponent {
	constructor(options: ConfirmModalOptions) {
		const {
			title,
			content,
			confirmText = 'Confirm',
			cancelText = 'Cancel',
			onConfirm,
			onCancel,
		} = options;

		const modalOptions: BaseModalOptions = {
			title: title ?? 'Confirmation',
			content: content ?? 'Are you sure?',
			canClose: true,
			onClose: onCancel,
			buttons: [
				{
					text: cancelText,
					style: 'secondary',
					onClick: (): void => {
						onCancel?.();
					},
				},
				{
					text: confirmText,
					style: 'danger',
					onClick: async (): Promise<void> => {
						await onConfirm();
					},
				},
			],
		};
		super(modalOptions);
	}

	protected render(): void {
		super.render();
	}
}

<script lang="ts">
	import { enhance } from '$app/forms';
	import CircleCheck from '@lucide/svelte/icons/circle-check';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { CONTACT_EMAIL, hrefFor } from '#lib/site.js';
	import Turnstile from './Turnstile.svelte';

	type Values = Record<
		'name' | 'company' | 'email' | 'phone' | 'employees' | 'topic' | 'message',
		string
	>;
	type FormResult =
		| { success: true }
		| { values: Values; error: 'invalid' | 'captcha' | 'send'; fields: string[] }
		| null
		| undefined;

	let {
		form,
		topic,
		turnstileSiteKey
	}: { form: FormResult; topic: string; turnstileSiteKey: string | null } = $props();

	let sending = $state(false);
	let turnstile = $state<ReturnType<typeof Turnstile>>();

	const failure = $derived(form && 'error' in form ? form : null);
	const values = $derived<Partial<Values>>(failure?.values ?? { topic });
	const invalid = (field: string) => failure?.fields.includes(field) ?? false;

	const errorText: Record<string, () => string> = {
		name: m.form_error_name,
		email: m.form_error_email,
		phone: m.form_error_phone,
		message: m.form_error_message,
		consent: m.form_error_consent
	};

	const topicOptions = [
		{ value: 'demo', label: m.topic_demo() },
		{ value: 'quote', label: m.topic_quote() },
		{ value: 'question', label: m.topic_question() }
	];

	const employeeOptions = [
		{ value: '1-10', label: '1–10' },
		{ value: '11-50', label: '11–50' },
		{ value: '51-200', label: '51–200' },
		{ value: '201+', label: m.employees_more() }
	];

	const input =
		'mt-2 block w-full rounded-lg border bg-white px-3.5 py-2.5 text-ink shadow-xs transition-colors placeholder:text-muted/60 focus:border-brand focus:ring-3 focus:ring-brand/15 focus:outline-none';
	const border = (field: string) => (invalid(field) ? 'border-red-500' : 'border-line');
</script>

{#if form && 'success' in form}
	<div class="flex flex-col items-start gap-4 py-6" role="status">
		<CircleCheck class="size-10 text-emerald-600" aria-hidden="true" />
		<h2 class="text-2xl title">{m.form_success_title()}</h2>
		<p class="text-muted">{m.form_success_text()}</p>
		<a href={hrefFor('/', getLocale())} class="mt-2 btn-outline">{m.form_success_back()}</a>
	</div>
{:else}
	<form
		method="POST"
		novalidate
		use:enhance={() => {
			sending = true;
			return async ({ result, update }) => {
				sending = false;
				if (result.type === 'failure') turnstile?.reset();
				await update({ reset: false });
			};
		}}
		class="space-y-5"
	>
		{#if failure}
			<p class="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
				{#if failure.error === 'captcha'}
					{m.form_error_captcha()}
				{:else if failure.error === 'send'}
					{m.form_error_send()}
					<a href="mailto:{CONTACT_EMAIL}" class="font-medium underline">{CONTACT_EMAIL}</a>
				{:else}
					{m.form_error_summary()}
				{/if}
			</p>
		{/if}

		<fieldset>
			<legend class="text-sm font-medium">{m.field_topic()}</legend>
			<div class="mt-2 grid grid-cols-3 gap-2">
				{#each topicOptions as option (option.value)}
					<label
						class="flex cursor-pointer items-center justify-center rounded-lg border border-line bg-white px-3 py-2.5 text-sm font-medium transition-colors has-checked:border-ink has-checked:bg-ink has-checked:text-white has-focus-visible:ring-3 has-focus-visible:ring-brand/30"
					>
						<input
							type="radio"
							name="topic"
							value={option.value}
							checked={values.topic === option.value}
							class="sr-only"
						/>
						{option.label}
					</label>
				{/each}
			</div>
		</fieldset>

		<div class="grid gap-5 sm:grid-cols-2">
			<div>
				<label for="name" class="text-sm font-medium">{m.field_name()}</label>
				<input
					id="name"
					name="name"
					autocomplete="name"
					required
					maxlength="100"
					value={values.name ?? ''}
					aria-invalid={invalid('name')}
					aria-describedby={invalid('name') ? 'name-error' : undefined}
					class="{input} {border('name')}"
				/>
				{#if invalid('name')}
					<p id="name-error" class="mt-1.5 text-sm text-red-600">{errorText.name()}</p>
				{/if}
			</div>
			<div>
				<label for="company" class="text-sm font-medium">
					{m.field_company()} <span class="font-normal text-muted">({m.field_optional()})</span>
				</label>
				<input
					id="company"
					name="company"
					autocomplete="organization"
					maxlength="120"
					value={values.company ?? ''}
					class="{input} border-line"
				/>
			</div>
			<div>
				<label for="email" class="text-sm font-medium">{m.field_email()}</label>
				<input
					id="email"
					name="email"
					type="email"
					autocomplete="email"
					required
					maxlength="200"
					value={values.email ?? ''}
					aria-invalid={invalid('email')}
					aria-describedby={invalid('email') ? 'email-error' : undefined}
					class="{input} {border('email')}"
				/>
				{#if invalid('email')}
					<p id="email-error" class="mt-1.5 text-sm text-red-600">{errorText.email()}</p>
				{/if}
			</div>
			<div>
				<label for="phone" class="text-sm font-medium">
					{m.field_phone()} <span class="font-normal text-muted">({m.field_optional()})</span>
				</label>
				<input
					id="phone"
					name="phone"
					type="tel"
					autocomplete="tel"
					maxlength="40"
					value={values.phone ?? ''}
					aria-invalid={invalid('phone')}
					aria-describedby={invalid('phone') ? 'phone-error' : undefined}
					class="{input} {border('phone')}"
				/>
				{#if invalid('phone')}
					<p id="phone-error" class="mt-1.5 text-sm text-red-600">{errorText.phone()}</p>
				{/if}
			</div>
		</div>

		<div>
			<label for="employees" class="text-sm font-medium">
				{m.field_employees()} <span class="font-normal text-muted">({m.field_optional()})</span>
			</label>
			<select id="employees" name="employees" class="{input} border-line">
				<option value="">{m.field_employees_placeholder()}</option>
				{#each employeeOptions as option (option.value)}
					<option value={option.value} selected={values.employees === option.value}>
						{option.label}
					</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="message" class="text-sm font-medium">{m.field_message()}</label>
			<textarea
				id="message"
				name="message"
				rows="5"
				required
				minlength="10"
				maxlength="4000"
				placeholder={m.field_message_placeholder()}
				aria-invalid={invalid('message')}
				aria-describedby={invalid('message') ? 'message-error' : undefined}
				class="{input} {border('message')} resize-y">{values.message ?? ''}</textarea
			>
			{#if invalid('message')}
				<p id="message-error" class="mt-1.5 text-sm text-red-600">{errorText.message()}</p>
			{/if}
		</div>

		<!-- Champ piège : invisible pour les humains, rempli par les robots -->
		<div class="absolute -left-[9999px]" aria-hidden="true">
			<label>Website <input name="website" tabindex="-1" autocomplete="off" /></label>
		</div>

		<div>
			<label class="flex items-start gap-3 text-sm">
				<input
					type="checkbox"
					name="consent"
					required
					aria-invalid={invalid('consent')}
					aria-describedby={invalid('consent') ? 'consent-error' : undefined}
					class="mt-0.5 size-4 shrink-0 rounded border-line accent-ink"
				/>
				<span class="text-muted">{m.field_consent()}</span>
			</label>
			{#if invalid('consent')}
				<p id="consent-error" class="mt-1.5 text-sm text-red-600">{errorText.consent()}</p>
			{/if}
		</div>

		{#if turnstileSiteKey}
			<Turnstile bind:this={turnstile} siteKey={turnstileSiteKey} language={getLocale()} />
		{/if}

		<button type="submit" class="btn-dark w-full sm:w-auto" disabled={sending}>
			{sending ? m.form_sending() : m.form_submit()}
		</button>
	</form>
{/if}

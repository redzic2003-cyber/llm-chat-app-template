import { fail } from '@sveltejs/kit';
import * as v from 'valibot';
import { dev } from '$app/env';
import {
	CONTACT_FROM_EMAIL,
	CONTACT_TO_EMAIL,
	RESEND_API_KEY,
	TURNSTILE_SECRET_KEY
} from '$app/env/private';
import { PUBLIC_TURNSTILE_SITE_KEY } from '$app/env/public';
import { getLocale } from '#lib/paraglide/runtime.js';
import {
	buildEmail,
	contactSchema,
	invalidFields,
	readValues,
	sendWithResend,
	topics,
	verifyTurnstile,
	type ContactValues
} from '#lib/server/contact.js';
import type { Actions, PageServerLoad } from './$types';

// Page dynamique : le formulaire est traité par le Worker Cloudflare.
export const prerender = false;

export const load: PageServerLoad = ({ url }) => {
	const topic = url.searchParams.get('topic');
	return {
		turnstileSiteKey: PUBLIC_TURNSTILE_SITE_KEY ?? null,
		topic: topics.find((t) => t === topic) ?? 'demo'
	};
};

export const actions: Actions = {
	default: async ({ request, getClientAddress }) => {
		const data = await request.formData();
		const { consent, ...values } = readValues(data);

		// Champ piège invisible : seuls les robots le remplissent. On simule un succès.
		if (data.get('website')) return { success: true as const };

		const failWith = (status: number, error: 'captcha' | 'send') =>
			fail(status, { values: values satisfies ContactValues, error, fields: [] as string[] });

		const parsed = v.safeParse(contactSchema, { ...values, consent });
		if (!parsed.success) {
			return fail(400, {
				values,
				error: 'invalid' as const,
				fields: invalidFields(parsed.issues) as string[]
			});
		}

		if (TURNSTILE_SECRET_KEY) {
			const token = data.get('cf-turnstile-response');
			const ok = await verifyTurnstile(
				TURNSTILE_SECRET_KEY,
				typeof token === 'string' ? token : '',
				getClientAddress()
			);
			if (!ok) return failWith(400, 'captcha');
		}

		const email = buildEmail(parsed.output, getLocale());

		if (!RESEND_API_KEY) {
			if (dev) {
				// En local, sans clé Resend : on affiche l'email dans le terminal.
				console.info(
					`\n--- Email de contact (non envoyé) ---\n${email.subject}\n\n${email.text}\n`
				);
				return { success: true as const };
			}
			console.error('RESEND_API_KEY manquante : impossible d’envoyer la demande de contact.');
			return failWith(503, 'send');
		}

		const sent = await sendWithResend({
			apiKey: RESEND_API_KEY,
			from: CONTACT_FROM_EMAIL,
			to: CONTACT_TO_EMAIL,
			replyTo: parsed.output.email,
			...email
		});
		if (!sent) return failWith(502, 'send');

		return { success: true as const };
	}
};

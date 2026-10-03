import { defineEnvVars } from '@sveltejs/kit/env';

// Toutes optionnelles pour que le site tourne en local sans configuration.
// En production, les définir dans Cloudflare (voir README, section Formulaire de contact).
const optional = (value: string | undefined) => value || undefined;

export const variables = defineEnvVars({
	RESEND_API_KEY: {
		schema: optional,
		description: 'Clé API Resend pour envoyer les demandes de contact par email (secret).'
	},
	CONTACT_TO_EMAIL: {
		schema: (value) => value || 'contact@chronoid.ch',
		description: 'Adresse qui reçoit les demandes de contact.'
	},
	CONTACT_FROM_EMAIL: {
		schema: (value) => value || 'chronoID <site@chronoid.ch>',
		description: 'Expéditeur des emails, sur un domaine vérifié dans Resend.'
	},
	TURNSTILE_SECRET_KEY: {
		schema: optional,
		description: 'Clé secrète Cloudflare Turnstile (anti-spam).'
	},
	PUBLIC_TURNSTILE_SITE_KEY: {
		public: true,
		schema: optional,
		description: 'Clé publique Cloudflare Turnstile, affichée dans le formulaire.'
	}
});

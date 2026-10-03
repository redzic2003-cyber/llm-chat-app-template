import { getLocale, localizeHref, type Locale } from '#lib/paraglide/runtime.js';
import { BASE_PATH } from '#lib/base-path.js';

/** Domaine de production (sans le sous-chemin), utilisé pour hreflang et canonical. */
export const SITE_URL = 'https://qrexpress.ch';

export const CONTACT_EMAIL = 'contact@chronoid.ch';

export const localeNames: Record<Locale, string> = {
	fr: 'Français',
	de: 'Deutsch',
	it: 'Italiano',
	en: 'English'
};

/** Chemin dans l'application, sans le sous-chemin ni la langue (`/frontend/de/contact` → `/de/contact`). */
export function appPath(pathname: string): string {
	return pathname.startsWith(BASE_PATH) ? pathname.slice(BASE_PATH.length) || '/' : pathname;
}

/**
 * Lien complet vers `path` (chemin de l'application, ex. `/contact`) dans la langue voulue,
 * avec le sous-chemin et sans slash final : `/frontend/de/contact`.
 */
export function hrefFor(path: string, locale: Locale): string {
	const href = localizeHref(`${BASE_PATH}${path}`, { locale });
	// L'accueil français est servi tel quel en `/frontend/` (Cloudflare y redirige `/frontend`).
	if (href === `${BASE_PATH}/`) return href;
	return href.length > 1 ? href.replace(/\/$/, '') : href;
}

/** Lien vers la page de contact dans la langue en cours, avec le sujet présélectionné. */
export function contactHref(topic?: 'demo' | 'quote' | 'question'): string {
	const href = hrefFor('/contact', getLocale());
	return topic ? `${href}?topic=${topic}` : href;
}

/** Lien vers une section de l'accueil, utilisable depuis n'importe quelle page. */
export function sectionHref(id: string): string {
	return `${hrefFor('/', getLocale())}#${id}`;
}

import { getLocale, localizeHref, type Locale } from '#lib/paraglide/runtime.js';

/** Domaine de production, utilisé pour les balises hreflang et canonical. À remplacer. */
export const SITE_URL = 'https://www.chronoid.ch';

export const CONTACT_EMAIL = 'contact@chronoid.ch';

export const localeNames: Record<Locale, string> = {
	fr: 'Français',
	de: 'Deutsch',
	it: 'Italiano',
	en: 'English'
};

/** Lien vers `pathname` dans la langue voulue, sans slash final (`/de` et non `/de/`). */
export function hrefFor(pathname: string, locale: Locale): string {
	const href = localizeHref(pathname, { locale });
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

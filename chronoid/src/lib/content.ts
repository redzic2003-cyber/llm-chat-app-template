import type { Picture } from '@sveltejs/enhanced-img';
import { m } from '#lib/paraglide/messages.js';
import bureau from '#lib/assets/images/bureau-badgeuse.jpg?enhanced';
import industrie from '#lib/assets/images/industrie.jpg?enhanced';
import sante from '#lib/assets/images/sante.jpg?enhanced';
import campus from '#lib/assets/images/campus.jpg?enhanced';
import evenement from '#lib/assets/images/evenement.jpg?enhanced';
import borneMurale from '#lib/assets/images/borne-murale.jpg?enhanced';
import borneSurPied from '#lib/assets/images/borne-sur-pied.jpg?enhanced';

// Fonctions plutôt que constantes : les textes dépendent de la langue en cours.

export type NavLink = { label: string; href: string };

export const navLinks = (): NavLink[] => [
	{ label: m.nav_products(), href: '#produits' },
	{ label: m.nav_solutions(), href: '#solutions' },
	{ label: m.nav_sectors(), href: '#secteurs' },
	{ label: m.nav_app(), href: '#application' }
];

export type Sector = { title: string; text: string; image: Picture; alt: string };

export const sectors = (): Sector[] => [
	{
		title: m.sector_office_title(),
		text: m.sector_office_text(),
		image: bureau,
		alt: m.sector_office_alt()
	},
	{
		title: m.sector_industry_title(),
		text: m.sector_industry_text(),
		image: industrie,
		alt: m.sector_industry_alt()
	},
	{
		title: m.sector_health_title(),
		text: m.sector_health_text(),
		image: sante,
		alt: m.sector_health_alt()
	},
	{
		title: m.sector_campus_title(),
		text: m.sector_campus_text(),
		image: campus,
		alt: m.sector_campus_alt()
	},
	{
		title: m.sector_events_title(),
		text: m.sector_events_text(),
		image: evenement,
		alt: m.sector_events_alt()
	}
];

export type Product = {
	name: string;
	tagline: string;
	features: string[];
	image: Picture;
	alt: string;
};

export const products = (): Product[] => [
	{
		name: m.product_wall_name(),
		tagline: m.product_wall_tagline(),
		features: [m.product_wall_f1(), m.product_wall_f2(), m.product_wall_f3()],
		image: borneMurale,
		alt: m.product_wall_alt()
	},
	{
		name: m.product_stand_name(),
		tagline: m.product_stand_tagline(),
		features: [m.product_stand_f1(), m.product_stand_f2(), m.product_stand_f3()],
		image: borneSurPied,
		alt: m.product_stand_alt()
	}
];

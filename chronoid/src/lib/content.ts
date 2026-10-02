import type { Picture } from '@sveltejs/enhanced-img';
import bureau from '#lib/assets/images/bureau-badgeuse.jpg?enhanced';
import industrie from '#lib/assets/images/industrie.jpg?enhanced';
import sante from '#lib/assets/images/sante.jpg?enhanced';
import campus from '#lib/assets/images/campus.jpg?enhanced';
import evenement from '#lib/assets/images/evenement.jpg?enhanced';
import borneMurale from '#lib/assets/images/borne-murale.jpg?enhanced';
import borneSurPied from '#lib/assets/images/borne-sur-pied.jpg?enhanced';

export type NavLink = { label: string; href: string };

export const navLinks: NavLink[] = [
	{ label: 'Produits', href: '#produits' },
	{ label: 'Solutions', href: '#solutions' },
	{ label: 'Secteurs', href: '#secteurs' },
	{ label: 'Application', href: '#application' }
];

export type Sector = { title: string; text: string; image: Picture; alt: string };

export const sectors: Sector[] = [
	{
		title: 'Entreprises et bureaux',
		text: 'Pointage des collaborateurs et accès aux locaux depuis une seule borne.',
		image: bureau,
		alt: 'Une collaboratrice présente son badge sur une borne murale chronoID'
	},
	{
		title: 'Industrie et production',
		text: 'Bornes robustes pour les équipes en horaires décalés.',
		image: industrie,
		alt: 'Un technicien en tenue de chantier badge sur une borne murale'
	},
	{
		title: 'Santé et établissements',
		text: 'Accès sécurisés aux zones sensibles et suivi des présences.',
		image: sante,
		alt: 'Une soignante badge à l’entrée d’un service hospitalier'
	},
	{
		title: 'Écoles et campus',
		text: 'Contrôle des entrées pour étudiants, enseignants et personnel.',
		image: campus,
		alt: 'Un étudiant badge sur une borne murale à l’entrée d’un campus'
	},
	{
		title: 'Événements',
		text: 'Accueil des participants sur borne autonome, sans installation lourde.',
		image: evenement,
		alt: 'Une visiteuse badge sur une borne sur pied à l’accueil d’un événement'
	}
];

export type Product = {
	name: string;
	tagline: string;
	features: string[];
	image: Picture;
	alt: string;
};

export const products: Product[] = [
	{
		name: 'Borne murale',
		tagline: 'Compacte, elle se fixe à l’entrée de chaque zone.',
		features: ['Lecteur de badge sans contact', 'Écran tactile', 'Version connectée ou autonome'],
		image: borneMurale,
		alt: 'Borne murale chronoID fixée sur un mur en béton'
	},
	{
		name: 'Borne sur pied',
		tagline: 'Idéale pour les halls d’accueil et les événements.',
		features: ['Aucune fixation murale', 'Grand écran lisible', 'Déplaçable selon vos besoins'],
		image: borneSurPied,
		alt: 'Borne sur pied chronoID dans un hall d’entrée'
	}
];

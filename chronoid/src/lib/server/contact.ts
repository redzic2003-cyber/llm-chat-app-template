import * as v from 'valibot';

export const topics = ['demo', 'quote', 'question'] as const;
export type Topic = (typeof topics)[number];

export const employeeRanges = ['1-10', '11-50', '51-200', '201+'] as const;

/** Champs renvoyés au formulaire après une erreur, pour ne rien faire retaper. */
export type ContactValues = {
	name: string;
	company: string;
	email: string;
	phone: string;
	employees: string;
	topic: string;
	message: string;
};

export type ContactField = keyof ContactValues | 'consent';

const text = (max: number) => v.pipe(v.string(), v.trim(), v.maxLength(max));

export const contactSchema = v.object({
	name: v.pipe(text(100), v.minLength(1)),
	company: text(120),
	email: v.pipe(text(200), v.email()),
	phone: v.pipe(text(40), v.regex(/^[+\d\s().-]*$/)),
	employees: v.union([v.picklist(employeeRanges), v.literal('')]),
	topic: v.picklist(topics),
	message: v.pipe(text(4000), v.minLength(10)),
	consent: v.literal('on')
});

export type ContactRequest = v.InferOutput<typeof contactSchema>;

export function readValues(data: FormData): ContactValues & { consent: string } {
	const get = (key: string) => {
		const value = data.get(key);
		return typeof value === 'string' ? value : '';
	};
	return {
		name: get('name'),
		company: get('company'),
		email: get('email'),
		phone: get('phone'),
		employees: get('employees'),
		topic: get('topic'),
		message: get('message'),
		consent: get('consent')
	};
}

/** Liste des champs invalides, d'après les erreurs Valibot. */
export function invalidFields(issues: v.BaseIssue<unknown>[]): ContactField[] {
	const fields = new Set<ContactField>();
	for (const issue of issues) {
		const key = issue.path?.[0]?.key;
		if (typeof key === 'string') fields.add(key as ContactField);
	}
	return [...fields];
}

/** Vérifie le jeton Cloudflare Turnstile côté serveur. */
export async function verifyTurnstile(
	secret: string,
	token: string,
	ip: string | undefined
): Promise<boolean> {
	if (!token) return false;
	const body = new FormData();
	body.set('secret', secret);
	body.set('response', token);
	if (ip) body.set('remoteip', ip);

	const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
		method: 'POST',
		body
	});
	if (!res.ok) return false;
	const result = (await res.json()) as { success?: boolean };
	return result.success === true;
}

const topicLabels: Record<Topic, string> = {
	demo: 'Demande de démo',
	quote: 'Demande de devis',
	question: 'Question'
};

/** Email texte envoyé à l'équipe chronoID (toujours en français). */
export function buildEmail(req: ContactRequest, locale: string) {
	const subject = `[chronoID] ${topicLabels[req.topic]} : ${req.name}${req.company ? ` (${req.company})` : ''}`;
	const lines = [
		`Demande : ${topicLabels[req.topic]}`,
		`Nom : ${req.name}`,
		`Entreprise : ${req.company || '-'}`,
		`Email : ${req.email}`,
		`Téléphone : ${req.phone || '-'}`,
		`Collaborateurs : ${req.employees || '-'}`,
		`Langue du site : ${locale}`,
		'',
		req.message
	];
	return { subject, text: lines.join('\n') };
}

/** Envoie l'email via l'API Resend (fonctionne sur Cloudflare Workers, pas de SDK Node). */
export async function sendWithResend(options: {
	apiKey: string;
	from: string;
	to: string;
	replyTo: string;
	subject: string;
	text: string;
}): Promise<boolean> {
	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${options.apiKey}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			from: options.from,
			to: [options.to],
			reply_to: options.replyTo,
			subject: options.subject,
			text: options.text
		})
	});
	if (!res.ok) console.error('Resend', res.status, await res.text());
	return res.ok;
}

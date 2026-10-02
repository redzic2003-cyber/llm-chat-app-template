//! Règles de pointage, sans dépendance à l'interface ni à la base :
//! nature d'un pointage, calcul des heures, anti double-badge, lecture des badges.

use chrono::{Datelike, Duration, NaiveDate, NaiveDateTime, Weekday};

/// Nature d'un pointage, déduite de sa position dans la journée.
/// 1er = Arrivée, puis alternance Départ / Retour.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Nature {
    Arrivee,
    Depart,
    Retour,
}

impl Nature {
    pub fn depuis_index(index: usize) -> Nature {
        match index {
            0 => Nature::Arrivee,
            i if i % 2 == 1 => Nature::Depart,
            _ => Nature::Retour,
        }
    }

    pub fn libelle(self) -> &'static str {
        match self {
            Nature::Arrivee => "Arrivée",
            Nature::Depart => "Départ",
            Nature::Retour => "Retour",
        }
    }
}

/// Résultat du calcul d'une journée.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Journee {
    /// Temps de travail compté.
    pub travaille: Duration,
    /// Un pointage manque (nombre impair un jour passé) : la dernière période n'est pas comptée.
    pub incomplete: bool,
    /// La personne est actuellement présente (journée en cours, nombre impair).
    pub en_cours: bool,
}

/// Calcule le temps travaillé d'une journée à partir de ses pointages triés.
///
/// Les pointages sont pris par paires (entrée → sortie). S'il en reste un seul
/// à la fin, `maintenant` est utilisé pour une journée en cours ; sinon la
/// journée est marquée incomplète et la période ouverte n'est pas comptée.
pub fn calculer_journee(pointages: &[NaiveDateTime], maintenant: Option<NaiveDateTime>) -> Journee {
    let mut travaille = Duration::zero();
    for paire in pointages.chunks(2) {
        if let [debut, fin] = paire {
            travaille += *fin - *debut;
        }
    }
    let mut incomplete = false;
    let mut en_cours = false;
    if pointages.len() % 2 == 1 {
        let dernier = *pointages.last().unwrap();
        match maintenant {
            Some(m) if m.date() == dernier.date() && m >= dernier => {
                travaille += m - dernier;
                en_cours = true;
            }
            _ => incomplete = true,
        }
    }
    Journee {
        travaille,
        incomplete,
        en_cours,
    }
}

/// Si le dernier pointage date de moins de `delai_min` minutes, renvoie le
/// nombre de minutes écoulées (le nouveau pointage doit être refusé).
pub fn trop_tot(
    dernier: Option<NaiveDateTime>,
    maintenant: NaiveDateTime,
    delai_min: i64,
) -> Option<i64> {
    let ecart = maintenant - dernier?;
    (ecart >= Duration::zero() && ecart < Duration::minutes(delai_min)).then(|| ecart.num_minutes())
}

/// Format long : « 7 h 05 ».
pub fn format_duree(d: Duration) -> String {
    let m = d.num_minutes().max(0);
    format!("{} h {:02}", m / 60, m % 60)
}

/// Format court pour les tableaux : « 7h05 ».
pub fn format_duree_court(d: Duration) -> String {
    let m = d.num_minutes().max(0);
    format!("{}h{:02}", m / 60, m % 60)
}

/// Lundi de la semaine contenant `date`.
pub fn debut_semaine(date: NaiveDate) -> NaiveDate {
    date - Duration::days(date.weekday().num_days_from_monday() as i64)
}

/// Premier jour du mois contenant `date`.
pub fn debut_mois(date: NaiveDate) -> NaiveDate {
    date.with_day(1).unwrap()
}

/// Premier jour du mois suivant.
pub fn mois_suivant(date: NaiveDate) -> NaiveDate {
    let d = debut_mois(date);
    if d.month() == 12 {
        NaiveDate::from_ymd_opt(d.year() + 1, 1, 1).unwrap()
    } else {
        NaiveDate::from_ymd_opt(d.year(), d.month() + 1, 1).unwrap()
    }
}

pub fn nom_jour(w: Weekday) -> &'static str {
    [
        "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche",
    ][w.num_days_from_monday() as usize]
}

pub fn nom_mois(m: u32) -> &'static str {
    [
        "janvier",
        "février",
        "mars",
        "avril",
        "mai",
        "juin",
        "juillet",
        "août",
        "septembre",
        "octobre",
        "novembre",
        "décembre",
    ][(m - 1) as usize]
}

/// « Jeudi 2 octobre 2026 »
pub fn date_longue(d: NaiveDate) -> String {
    format!(
        "{} {} {} {}",
        nom_jour(d.weekday()),
        d.day(),
        nom_mois(d.month()),
        d.year()
    )
}

/// « Jeu 02/10 »
pub fn date_courte(d: NaiveDate) -> String {
    format!(
        "{} {:02}/{:02}",
        &nom_jour(d.weekday())[..3],
        d.day(),
        d.month()
    )
}

/// Normalise ce qu'envoie un lecteur de badge en émulation clavier.
///
/// Sur un poste en AZERTY, un lecteur réglé en QWERTY « tape » `&é"'(-è_çà`
/// au lieu des chiffres : on les remet en chiffres. On ne garde que les
/// caractères alphanumériques, en majuscules.
pub fn normaliser_badge(brut: &str) -> String {
    brut.chars()
        .map(|c| match c {
            '&' => '1',
            'é' | 'É' => '2',
            '"' => '3',
            '\'' => '4',
            '(' => '5',
            '-' => '6',
            'è' | 'È' => '7',
            '_' => '8',
            'ç' | 'Ç' => '9',
            'à' | 'À' => '0',
            c => c,
        })
        .filter(|c| c.is_ascii_alphanumeric())
        .map(|c| c.to_ascii_uppercase())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn t(h: u32, m: u32) -> NaiveDateTime {
        NaiveDate::from_ymd_opt(2026, 10, 2)
            .unwrap()
            .and_hms_opt(h, m, 0)
            .unwrap()
    }

    #[test]
    fn nature_alterne() {
        let n: Vec<_> = (0..5).map(Nature::depuis_index).collect();
        assert_eq!(
            n,
            [
                Nature::Arrivee,
                Nature::Depart,
                Nature::Retour,
                Nature::Depart,
                Nature::Retour
            ]
        );
    }

    #[test]
    fn journee_complete() {
        let j = calculer_journee(&[t(8, 2), t(12, 1), t(13, 30), t(17, 32)], None);
        assert_eq!(j.travaille, Duration::minutes(3 * 60 + 59 + 4 * 60 + 2));
        assert!(!j.incomplete && !j.en_cours);
    }

    #[test]
    fn journee_en_cours_compte_jusqu_a_maintenant() {
        let j = calculer_journee(&[t(8, 0), t(12, 0), t(13, 30)], Some(t(15, 0)));
        assert_eq!(j.travaille, Duration::minutes(4 * 60 + 90));
        assert!(j.en_cours && !j.incomplete);
    }

    #[test]
    fn oubli_un_jour_passe_ne_compte_pas_la_periode_ouverte() {
        let lendemain = t(9, 0) + Duration::days(1);
        let j = calculer_journee(&[t(8, 0), t(12, 0), t(13, 30)], Some(lendemain));
        assert_eq!(j.travaille, Duration::hours(4));
        assert!(j.incomplete && !j.en_cours);
    }

    #[test]
    fn journee_vide() {
        let j = calculer_journee(&[], Some(t(10, 0)));
        assert_eq!(j.travaille, Duration::zero());
        assert!(!j.incomplete && !j.en_cours);
    }

    #[test]
    fn anti_double_badge() {
        assert_eq!(trop_tot(Some(t(8, 0)), t(8, 1), 2), Some(1));
        assert_eq!(trop_tot(Some(t(8, 0)), t(8, 2), 2), None);
        assert_eq!(trop_tot(None, t(8, 0), 2), None);
    }

    #[test]
    fn formats() {
        assert_eq!(format_duree(Duration::minutes(451)), "7 h 31");
        assert_eq!(format_duree_court(Duration::minutes(65)), "1h05");
    }

    #[test]
    fn dates() {
        let d = NaiveDate::from_ymd_opt(2026, 10, 2).unwrap();
        assert_eq!(
            debut_semaine(d),
            NaiveDate::from_ymd_opt(2026, 9, 28).unwrap()
        );
        assert_eq!(
            mois_suivant(NaiveDate::from_ymd_opt(2026, 12, 15).unwrap()),
            NaiveDate::from_ymd_opt(2027, 1, 1).unwrap()
        );
        assert_eq!(date_longue(d), "Vendredi 2 octobre 2026");
        assert_eq!(date_courte(d), "Ven 02/10");
    }

    #[test]
    fn badge_azerty_et_separateurs() {
        assert_eq!(normaliser_badge("&é\"'(-è_çà"), "1234567890");
        assert_eq!(normaliser_badge("04:a2:3f:1b\n"), "04A23F1B");
    }
}

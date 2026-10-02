//! Données de démonstration (option `--demo`) : quelques salariés et deux semaines de pointages.

use chrono::{Datelike, Duration, Local, NaiveTime};

use crate::db::{Db, Salarie, Signalement};

pub fn remplir(db: &Db) -> rusqlite::Result<()> {
    if !db.salaries(true)?.is_empty() || !db.salaries(false)?.is_empty() {
        return Ok(());
    }
    let personnes = [
        ("Marie", "Dupont", "04A23F1B", "1111"),
        ("Karim", "Benali", "04B7710C", "2222"),
        ("Lucas", "Martin", "04C1E2D3", "3333"),
        ("Sophie", "Bernard", "04D45566", "4444"),
        ("Paul", "Durand", "", "5555"),
        ("Julie", "Petit", "04E99A01", "6666"),
    ];
    let maintenant = Local::now().naive_local();
    let aujourd_hui = maintenant.date();
    for (i, (prenom, nom, badge, code)) in personnes.iter().enumerate() {
        let id = db.enregistrer_salarie(&Salarie {
            prenom: prenom.to_string(),
            nom: nom.to_string(),
            badge: (!badge.is_empty()).then(|| badge.to_string()),
            code: Some(code.to_string()),
            actif: true,
            ..Default::default()
        })?;
        for jours in (0..15).rev() {
            let d = aujourd_hui - Duration::days(jours);
            if d.weekday().num_days_from_monday() >= 5 {
                continue;
            }
            // Petites variations reproductibles selon la personne et le jour.
            let v = |base: u32, k: u32| -> i64 {
                ((i as u32 * 7 + d.day() * 3 + k) % 11) as i64 - 5 + base as i64
            };
            let horaires = [
                v(8 * 60, 0),
                v(12 * 60, 1),
                v(13 * 60 + 30, 2),
                v(17 * 60, 3),
            ];
            for (k, minutes) in horaires.iter().enumerate() {
                let quand = d.and_time(NaiveTime::MIN) + Duration::minutes(*minutes + i as i64 * 4);
                if quand > maintenant {
                    break;
                }
                // Un oubli : Karim n'a pas pointé son départ il y a 3 jours.
                if i == 1 && jours == 3 && k == 3 {
                    continue;
                }
                // Paul est absent aujourd'hui.
                if i == 4 && jours == 0 {
                    continue;
                }
                db.ajouter_pointage(id, quand, if badge.is_empty() { "code" } else { "badge" })?;
            }
        }
        if i == 1 {
            let jour = aujourd_hui - Duration::days(3);
            if jour.weekday().num_days_from_monday() < 5 {
                db.ajouter_signalement(&Signalement {
                    salarie_id: Some(id),
                    categorie: "oubli".into(),
                    demande_date: Some(jour),
                    demande_heure: NaiveTime::from_hms_opt(17, 30, 0),
                    demande_nature: "Départ".into(),
                    motif: "Badge oublié".into(),
                    ..Default::default()
                })?;
            }
        }
        if i == 0 {
            db.ajouter_signalement(&Signalement {
                salarie_id: Some(id),
                categorie: "materiel".into(),
                lieu: "Atelier".into(),
                urgence: 1,
                detail: "La perceuse à colonne fait un bruit anormal".into(),
                ..Default::default()
            })?;
        }
    }
    db.ajouter_signalement(&Signalement {
        categorie: "securite".into(),
        lieu: "Entrepôt".into(),
        urgence: 2,
        detail: "Câble électrique au sol près du quai 2".into(),
        ..Default::default()
    })?;
    db.definir_reglage("etablissement", "Ma Société — Démo")?;
    db.journaliser("Système", "Données de démonstration créées", "")?;
    Ok(())
}

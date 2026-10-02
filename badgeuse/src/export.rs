//! Export CSV lisible directement par Excel (séparateur « ; », UTF-8 avec BOM).

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::{Duration, NaiveDate};

use crate::db::Db;
use crate::pointage::{self, Nature};

/// Écrit le fichier sur la clé USB si une est montée, sinon dans `<dossier>/exports`.
/// Renvoie le chemin du fichier et le nombre de lignes.
pub fn exporter_csv(
    db: &Db,
    du: NaiveDate,
    au: NaiveDate,
    dossier: &Path,
) -> Result<(PathBuf, usize), String> {
    let contenu = generer_csv(db, du, au).map_err(|e| e.to_string())?;
    let nom = format!(
        "pointages_{}_{}.csv",
        du.format("%Y-%m-%d"),
        au.format("%Y-%m-%d")
    );
    let mut destinations: Vec<PathBuf> = cles_usb();
    destinations.push(dossier.join("exports"));
    let mut derniere_erreur = String::new();
    for d in destinations {
        let chemin = d.join(&nom);
        let ecrit = fs::create_dir_all(&d).and_then(|_| {
            let mut f = fs::File::create(&chemin)?;
            f.write_all(contenu.0.as_bytes())?;
            f.sync_all()
        });
        match ecrit {
            Ok(()) => return Ok((chemin, contenu.1)),
            Err(e) => derniere_erreur = format!("{} : {e}", d.display()),
        }
    }
    Err(derniere_erreur)
}

fn generer_csv(db: &Db, du: NaiveDate, au: NaiveDate) -> rusqlite::Result<(String, usize)> {
    let mut csv = String::from(
        "\u{FEFF}Nom;Prénom;Date;Jour;Pointages;Total (h:mm);Total (heures);Anomalie\r\n",
    );
    let mut lignes = 0;
    let mut salaries = db.salaries(true)?;
    salaries.extend(db.salaries(false)?);
    for s in salaries {
        let pts = db.pointages(s.id, du, au)?;
        let mut d = du;
        while d <= au {
            let heures: Vec<_> = pts
                .iter()
                .filter(|p| p.horodatage.date() == d)
                .map(|p| p.horodatage)
                .collect();
            if !heures.is_empty() {
                // Pas de « maintenant » : une journée ouverte est signalée comme incomplète.
                let j = pointage::calculer_journee(&heures, None);
                let liste = heures
                    .iter()
                    .enumerate()
                    .map(|(i, h)| {
                        format!(
                            "{} {}",
                            Nature::depuis_index(i).libelle(),
                            h.format("%H:%M")
                        )
                    })
                    .collect::<Vec<_>>()
                    .join(" | ");
                let anomalie = if j.incomplete {
                    format!("{} manquant", Nature::depuis_index(heures.len()).libelle())
                } else {
                    String::new()
                };
                csv += &format!(
                    "{};{};{};{};{};{};{};{}\r\n",
                    champ(&s.nom),
                    champ(&s.prenom),
                    d.format("%d/%m/%Y"),
                    pointage::nom_jour(chrono::Datelike::weekday(&d)),
                    champ(&liste),
                    hmm(j.travaille),
                    decimal(j.travaille),
                    anomalie
                );
                lignes += 1;
            }
            d = d.succ_opt().unwrap();
        }
    }
    Ok((csv, lignes))
}

fn champ(s: &str) -> String {
    if s.contains([';', '"', '\n']) {
        format!("\"{}\"", s.replace('"', "\"\""))
    } else {
        s.to_string()
    }
}

fn hmm(d: Duration) -> String {
    let m = d.num_minutes();
    format!("{}:{:02}", m / 60, m % 60)
}

/// Heures décimales avec virgule (Excel français) : 7 h 30 → « 7,50 ».
fn decimal(d: Duration) -> String {
    format!("{:.2}", d.num_minutes() as f64 / 60.0).replace('.', ",")
}

/// Points de montage des clés USB (Raspberry Pi OS / Ubuntu : /media/…, /run/media/…).
fn cles_usb() -> Vec<PathBuf> {
    let Ok(montages) = fs::read_to_string("/proc/mounts") else {
        return Vec::new();
    };
    montages
        .lines()
        .filter_map(|l| l.split_whitespace().nth(1))
        .map(|p| p.replace("\\040", " "))
        .filter(|p| p.starts_with("/media/") || p.starts_with("/run/media/"))
        .map(PathBuf::from)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Salarie;

    #[test]
    fn csv_avec_anomalie() {
        let db = Db::en_memoire();
        let id = db
            .enregistrer_salarie(&Salarie {
                prenom: "Marie".into(),
                nom: "Dupont".into(),
                code: Some("1111".into()),
                actif: true,
                ..Default::default()
            })
            .unwrap();
        let j1 = NaiveDate::from_ymd_opt(2026, 9, 28).unwrap();
        let j2 = j1.succ_opt().unwrap();
        for (j, h, m) in [
            (j1, 8, 0),
            (j1, 12, 0),
            (j1, 13, 30),
            (j1, 17, 0),
            (j2, 8, 0),
        ] {
            db.ajouter_pointage(id, j.and_hms_opt(h, m, 0).unwrap(), "badge")
                .unwrap();
        }
        let (csv, n) = generer_csv(&db, j1, j2).unwrap();
        assert_eq!(n, 2);
        assert!(csv.contains("Dupont;Marie;28/09/2026;Lundi;Arrivée 08:00 | Départ 12:00 | Retour 13:30 | Départ 17:00;7:30;7,50;"));
        assert!(csv.contains("29/09/2026;Mardi;Arrivée 08:00;0:00;0,00;Départ manquant"));
    }
}

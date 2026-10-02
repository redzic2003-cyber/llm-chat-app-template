//! Stockage SQLite local : salariés, pointages, signalements, journal, réglages.

use chrono::{Local, NaiveDate, NaiveDateTime, NaiveTime};
use rusqlite::{Connection, OptionalExtension, Result, Row, params};
use std::path::Path;

const FORMAT_TS: &str = "%Y-%m-%d %H:%M:%S";

#[derive(Debug, Clone, Default)]
pub struct Salarie {
    pub id: i64,
    pub prenom: String,
    pub nom: String,
    pub badge: Option<String>,
    pub code: Option<String>,
    pub actif: bool,
}

impl Salarie {
    pub fn nom_complet(&self) -> String {
        format!("{} {}", self.prenom, self.nom).trim().to_string()
    }
}

#[derive(Debug, Clone)]
pub struct Pointage {
    pub id: i64,
    pub horodatage: NaiveDateTime,
    /// badge, code, admin, demande
    pub source: String,
}

/// Signalement ou demande de correction envoyée depuis la badgeuse.
#[derive(Debug, Clone, Default)]
pub struct Signalement {
    pub id: i64,
    pub salarie_id: Option<i64>,
    /// oubli, erreur, badge, materiel, securite, autre
    pub categorie: String,
    pub lieu: String,
    /// 0 normal, 1 important, 2 urgent
    pub urgence: i32,
    pub detail: String,
    /// nouveau, en_cours, resolu, refuse
    pub statut: String,
    pub cree_le: Option<NaiveDateTime>,
    /// Pour oubli/erreur : le pointage demandé.
    pub demande_date: Option<NaiveDate>,
    pub demande_heure: Option<NaiveTime>,
    pub demande_nature: String,
    pub motif: String,
}

#[derive(Debug, Clone)]
pub struct EntreeJournal {
    pub horodatage: NaiveDateTime,
    pub auteur: String,
    pub action: String,
    pub motif: String,
}

pub struct Db {
    conn: Connection,
}

fn ts(dt: NaiveDateTime) -> String {
    dt.format(FORMAT_TS).to_string()
}

fn parse_ts(s: &str) -> NaiveDateTime {
    NaiveDateTime::parse_from_str(s, FORMAT_TS).unwrap_or_default()
}

fn salarie_depuis(row: &Row) -> Result<Salarie> {
    Ok(Salarie {
        id: row.get(0)?,
        prenom: row.get(1)?,
        nom: row.get(2)?,
        badge: row.get(3)?,
        code: row.get(4)?,
        actif: row.get(5)?,
    })
}

fn pointage_depuis(row: &Row) -> Result<Pointage> {
    Ok(Pointage {
        id: row.get(0)?,
        horodatage: parse_ts(&row.get::<_, String>(2)?),
        source: row.get(3)?,
    })
}

fn signalement_depuis(row: &Row) -> Result<Signalement> {
    let cree: String = row.get(8)?;
    let date: Option<String> = row.get(9)?;
    let heure: Option<String> = row.get(10)?;
    Ok(Signalement {
        id: row.get(0)?,
        salarie_id: row.get(1)?,
        categorie: row.get(2)?,
        lieu: row.get(3)?,
        urgence: row.get(4)?,
        detail: row.get(5)?,
        statut: row.get(6)?,
        motif: row.get(7)?,
        cree_le: Some(parse_ts(&cree)),
        demande_date: date.and_then(|d| NaiveDate::parse_from_str(&d, "%Y-%m-%d").ok()),
        demande_heure: heure.and_then(|h| NaiveTime::parse_from_str(&h, "%H:%M").ok()),
        demande_nature: row.get(11)?,
    })
}

const COLONNES_SALARIE: &str = "id, prenom, nom, badge, code, actif";
const COLONNES_SIGNALEMENT: &str = "id, salarie_id, categorie, lieu, urgence, detail, statut, motif, cree_le, demande_date, demande_heure, demande_nature";

impl Db {
    pub fn ouvrir(chemin: &Path) -> Result<Db> {
        let db = Db {
            conn: Connection::open(chemin)?,
        };
        db.creer_schema()?;
        Ok(db)
    }

    #[cfg(test)]
    pub fn en_memoire() -> Db {
        let db = Db {
            conn: Connection::open_in_memory().unwrap(),
        };
        db.creer_schema().unwrap();
        db
    }

    fn creer_schema(&self) -> Result<()> {
        self.conn.execute_batch(
            "PRAGMA foreign_keys = ON;
             PRAGMA journal_mode = WAL;
             CREATE TABLE IF NOT EXISTS salaries (
                 id INTEGER PRIMARY KEY,
                 prenom TEXT NOT NULL,
                 nom TEXT NOT NULL,
                 badge TEXT UNIQUE,
                 code TEXT UNIQUE,
                 actif INTEGER NOT NULL DEFAULT 1
             );
             CREATE TABLE IF NOT EXISTS pointages (
                 id INTEGER PRIMARY KEY,
                 salarie_id INTEGER NOT NULL REFERENCES salaries(id),
                 horodatage TEXT NOT NULL,
                 source TEXT NOT NULL
             );
             CREATE INDEX IF NOT EXISTS idx_pointages ON pointages(salarie_id, horodatage);
             CREATE TABLE IF NOT EXISTS signalements (
                 id INTEGER PRIMARY KEY,
                 salarie_id INTEGER REFERENCES salaries(id),
                 categorie TEXT NOT NULL,
                 lieu TEXT NOT NULL DEFAULT '',
                 urgence INTEGER NOT NULL DEFAULT 0,
                 detail TEXT NOT NULL DEFAULT '',
                 statut TEXT NOT NULL DEFAULT 'nouveau',
                 motif TEXT NOT NULL DEFAULT '',
                 cree_le TEXT NOT NULL,
                 demande_date TEXT,
                 demande_heure TEXT,
                 demande_nature TEXT NOT NULL DEFAULT ''
             );
             CREATE TABLE IF NOT EXISTS journal (
                 id INTEGER PRIMARY KEY,
                 horodatage TEXT NOT NULL,
                 auteur TEXT NOT NULL,
                 action TEXT NOT NULL,
                 motif TEXT NOT NULL DEFAULT ''
             );
             -- Le journal ne peut être ni modifié ni effacé.
             CREATE TRIGGER IF NOT EXISTS journal_sans_modif BEFORE UPDATE ON journal
                 BEGIN SELECT RAISE(ABORT, 'journal en lecture seule'); END;
             CREATE TRIGGER IF NOT EXISTS journal_sans_suppr BEFORE DELETE ON journal
                 BEGIN SELECT RAISE(ABORT, 'journal en lecture seule'); END;
             CREATE TABLE IF NOT EXISTS reglages (cle TEXT PRIMARY KEY, valeur TEXT NOT NULL);",
        )
    }

    // ---------- Réglages ----------

    pub fn reglage(&self, cle: &str, defaut: &str) -> String {
        self.conn
            .query_row("SELECT valeur FROM reglages WHERE cle = ?1", [cle], |r| {
                r.get(0)
            })
            .optional()
            .ok()
            .flatten()
            .unwrap_or_else(|| defaut.to_string())
    }

    pub fn definir_reglage(&self, cle: &str, valeur: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO reglages(cle, valeur) VALUES (?1, ?2) ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur",
            params![cle, valeur],
        )?;
        Ok(())
    }

    // ---------- Salariés ----------

    pub fn salaries(&self, actifs: bool) -> Result<Vec<Salarie>> {
        let mut st = self.conn.prepare(&format!(
            "SELECT {COLONNES_SALARIE} FROM salaries WHERE actif = ?1 ORDER BY nom COLLATE NOCASE, prenom COLLATE NOCASE"
        ))?;
        st.query_map([actifs], salarie_depuis)?.collect()
    }

    pub fn salarie(&self, id: i64) -> Result<Option<Salarie>> {
        self.conn
            .query_row(
                &format!("SELECT {COLONNES_SALARIE} FROM salaries WHERE id = ?1"),
                [id],
                salarie_depuis,
            )
            .optional()
    }

    pub fn salarie_par_badge(&self, badge: &str) -> Result<Option<Salarie>> {
        self.conn
            .query_row(
                &format!("SELECT {COLONNES_SALARIE} FROM salaries WHERE badge = ?1"),
                [badge],
                salarie_depuis,
            )
            .optional()
    }

    pub fn salarie_par_code(&self, code: &str) -> Result<Option<Salarie>> {
        self.conn
            .query_row(
                &format!("SELECT {COLONNES_SALARIE} FROM salaries WHERE code = ?1"),
                [code],
                salarie_depuis,
            )
            .optional()
    }

    /// Crée ou met à jour un salarié ; renvoie son id.
    pub fn enregistrer_salarie(&self, s: &Salarie) -> Result<i64> {
        if s.id == 0 {
            self.conn.execute(
                "INSERT INTO salaries(prenom, nom, badge, code, actif) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![s.prenom, s.nom, s.badge, s.code, s.actif],
            )?;
            Ok(self.conn.last_insert_rowid())
        } else {
            self.conn.execute(
                "UPDATE salaries SET prenom = ?1, nom = ?2, badge = ?3, code = ?4, actif = ?5 WHERE id = ?6",
                params![s.prenom, s.nom, s.badge, s.code, s.actif, s.id],
            )?;
            Ok(s.id)
        }
    }

    /// Tire un code à 4 chiffres libre.
    pub fn nouveau_code(&self) -> Result<String> {
        loop {
            let code = format!("{:04}", fastrand::u32(0..10_000));
            if self.salarie_par_code(&code)?.is_none() {
                return Ok(code);
            }
        }
    }

    // ---------- Pointages ----------

    pub fn ajouter_pointage(
        &self,
        salarie_id: i64,
        quand: NaiveDateTime,
        source: &str,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO pointages(salarie_id, horodatage, source) VALUES (?1, ?2, ?3)",
            params![salarie_id, ts(quand), source],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn pointage(&self, id: i64) -> Result<Option<Pointage>> {
        self.conn
            .query_row(
                "SELECT id, salarie_id, horodatage, source FROM pointages WHERE id = ?1",
                [id],
                pointage_depuis,
            )
            .optional()
    }

    pub fn supprimer_pointage(&self, id: i64) -> Result<()> {
        self.conn
            .execute("DELETE FROM pointages WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn modifier_pointage(&self, id: i64, quand: NaiveDateTime) -> Result<()> {
        self.conn.execute(
            "UPDATE pointages SET horodatage = ?1 WHERE id = ?2",
            params![ts(quand), id],
        )?;
        Ok(())
    }

    /// Pointages d'un salarié entre deux dates (incluses), triés.
    pub fn pointages(
        &self,
        salarie_id: i64,
        du: NaiveDate,
        au: NaiveDate,
    ) -> Result<Vec<Pointage>> {
        let mut st = self.conn.prepare(
            "SELECT id, salarie_id, horodatage, source FROM pointages
             WHERE salarie_id = ?1 AND horodatage >= ?2 AND horodatage < ?3 ORDER BY horodatage",
        )?;
        let debut = ts(du.and_hms_opt(0, 0, 0).unwrap());
        let fin = ts(au.succ_opt().unwrap().and_hms_opt(0, 0, 0).unwrap());
        st.query_map(params![salarie_id, debut, fin], pointage_depuis)?
            .collect()
    }

    pub fn dernier_pointage(&self, salarie_id: i64) -> Result<Option<NaiveDateTime>> {
        self.conn
            .query_row(
                "SELECT horodatage FROM pointages WHERE salarie_id = ?1 ORDER BY horodatage DESC LIMIT 1",
                [salarie_id],
                |r| r.get::<_, String>(0),
            )
            .optional()
            .map(|o| o.map(|s| parse_ts(&s)))
    }

    // ---------- Signalements ----------

    pub fn ajouter_signalement(&self, s: &Signalement) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO signalements(salarie_id, categorie, lieu, urgence, detail, statut, motif, cree_le,
                                      demande_date, demande_heure, demande_nature)
             VALUES (?1, ?2, ?3, ?4, ?5, 'nouveau', ?6, ?7, ?8, ?9, ?10)",
            params![
                s.salarie_id,
                s.categorie,
                s.lieu,
                s.urgence,
                s.detail,
                s.motif,
                ts(Local::now().naive_local()),
                s.demande_date.map(|d| d.format("%Y-%m-%d").to_string()),
                s.demande_heure.map(|h| h.format("%H:%M").to_string()),
                s.demande_nature,
            ],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    /// `ouverts` : nouveaux et en cours ; sinon : résolus et refusés.
    pub fn signalements(&self, ouverts: bool) -> Result<Vec<Signalement>> {
        let filtre = if ouverts {
            "IN ('nouveau', 'en_cours')"
        } else {
            "IN ('resolu', 'refuse')"
        };
        let mut st = self.conn.prepare(&format!(
            "SELECT {COLONNES_SIGNALEMENT} FROM signalements WHERE statut {filtre}
             ORDER BY urgence DESC, cree_le DESC LIMIT 300"
        ))?;
        st.query_map([], signalement_depuis)?.collect()
    }

    pub fn signalement(&self, id: i64) -> Result<Option<Signalement>> {
        self.conn
            .query_row(
                &format!("SELECT {COLONNES_SIGNALEMENT} FROM signalements WHERE id = ?1"),
                [id],
                signalement_depuis,
            )
            .optional()
    }

    /// Demandes de correction en attente pour un salarié.
    pub fn demandes_en_attente(&self, salarie_id: i64) -> Result<Vec<Signalement>> {
        let mut st = self.conn.prepare(&format!(
            "SELECT {COLONNES_SIGNALEMENT} FROM signalements
             WHERE salarie_id = ?1 AND categorie IN ('oubli', 'erreur') AND statut IN ('nouveau', 'en_cours')
             ORDER BY demande_date, demande_heure"
        ))?;
        st.query_map([salarie_id], signalement_depuis)?.collect()
    }

    pub fn changer_statut(&self, id: i64, statut: &str) -> Result<()> {
        self.conn.execute(
            "UPDATE signalements SET statut = ?1 WHERE id = ?2",
            params![statut, id],
        )?;
        Ok(())
    }

    pub fn nb_signalements_nouveaux(&self) -> Result<i64> {
        self.conn.query_row(
            "SELECT COUNT(*) FROM signalements WHERE statut = 'nouveau'",
            [],
            |r| r.get(0),
        )
    }

    // ---------- Journal ----------

    pub fn journaliser(&self, auteur: &str, action: &str, motif: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO journal(horodatage, auteur, action, motif) VALUES (?1, ?2, ?3, ?4)",
            params![ts(Local::now().naive_local()), auteur, action, motif],
        )?;
        Ok(())
    }

    pub fn journal(&self, limite: i64) -> Result<Vec<EntreeJournal>> {
        let mut st = self.conn.prepare(
            "SELECT horodatage, auteur, action, motif FROM journal ORDER BY id DESC LIMIT ?1",
        )?;
        st.query_map([limite], |r| {
            Ok(EntreeJournal {
                horodatage: parse_ts(&r.get::<_, String>(0)?),
                auteur: r.get(1)?,
                action: r.get(2)?,
                motif: r.get(3)?,
            })
        })?
        .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dt(j: u32, h: u32, m: u32) -> NaiveDateTime {
        NaiveDate::from_ymd_opt(2026, 10, j)
            .unwrap()
            .and_hms_opt(h, m, 0)
            .unwrap()
    }

    #[test]
    fn salarie_et_pointages() {
        let db = Db::en_memoire();
        let id = db
            .enregistrer_salarie(&Salarie {
                prenom: "Marie".into(),
                nom: "Dupont".into(),
                badge: Some("04A2".into()),
                code: Some("1234".into()),
                actif: true,
                ..Default::default()
            })
            .unwrap();
        assert_eq!(db.salarie_par_badge("04A2").unwrap().unwrap().id, id);
        assert_eq!(
            db.salarie_par_code("1234").unwrap().unwrap().nom_complet(),
            "Marie Dupont"
        );

        db.ajouter_pointage(id, dt(2, 13, 30), "badge").unwrap();
        db.ajouter_pointage(id, dt(2, 8, 0), "badge").unwrap();
        db.ajouter_pointage(id, dt(3, 8, 0), "badge").unwrap();
        let jour = NaiveDate::from_ymd_opt(2026, 10, 2).unwrap();
        let p = db.pointages(id, jour, jour).unwrap();
        assert_eq!(p.len(), 2);
        assert_eq!(p[0].horodatage, dt(2, 8, 0));
        assert_eq!(db.dernier_pointage(id).unwrap(), Some(dt(3, 8, 0)));
    }

    #[test]
    fn badge_unique() {
        let db = Db::en_memoire();
        let s = Salarie {
            prenom: "A".into(),
            badge: Some("X".into()),
            actif: true,
            ..Default::default()
        };
        db.enregistrer_salarie(&s).unwrap();
        assert!(db.enregistrer_salarie(&s).is_err());
    }

    #[test]
    fn journal_en_lecture_seule() {
        let db = Db::en_memoire();
        db.journaliser("Admin", "test", "").unwrap();
        assert!(db.conn.execute("DELETE FROM journal", []).is_err());
        assert!(
            db.conn
                .execute("UPDATE journal SET auteur = 'x'", [])
                .is_err()
        );
        assert_eq!(db.journal(10).unwrap().len(), 1);
    }

    #[test]
    fn reglages_par_defaut() {
        let db = Db::en_memoire();
        assert_eq!(db.reglage("x", "2"), "2");
        db.definir_reglage("x", "5").unwrap();
        db.definir_reglage("x", "7").unwrap();
        assert_eq!(db.reglage("x", "2"), "7");
    }
}

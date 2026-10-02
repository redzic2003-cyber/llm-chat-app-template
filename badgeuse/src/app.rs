//! Pilotage de l'interface : chaque appui envoie `Etat.action(nom, nombre, texte)`,
//! traité ici ; le code met ensuite à jour les propriétés affichées.

use std::path::PathBuf;
use std::time::{Duration as Delai, Instant};

use chrono::{Datelike, Duration, Local, NaiveDate, NaiveDateTime, NaiveTime, Timelike};
use slint::{ComponentHandle, Model, ModelRc, SharedString, VecModel};

use crate::db::{Db, Salarie, Signalement};
use crate::export;
use crate::pointage::{self, Nature};
use crate::{
    AppWindow, Ecran, Etat, LigneDemande, LigneJour, LigneJournal, LigneOubli, LignePointage,
    LignePresent, LigneSalarie, LigneSemaine, LigneSignalement,
};

const CODE_ADMIN_DEFAUT: &str = "000000";
const MOTIFS_MODIF: [&str; 4] = [
    "Oubli du salarié",
    "Erreur de pointage",
    "Badgeuse en panne",
    "Autre",
];
const MOTIFS_SUPPR: [&str; 3] = ["Doublon", "Erreur de pointage", "Autre"];
const MOTIFS_OUBLI: [&str; 3] = ["Badge oublié", "Badgeuse en panne", "Autre"];
const LIEUX: [&str; 5] = ["Atelier", "Bureau", "Entrepôt", "Extérieur", "Autre"];
const URGENCES: [&str; 3] = ["Normal", "Important", "Urgent"];

/// Ce que la saisie de code en cours doit déclencher.
#[derive(Clone, Copy, PartialEq, Debug)]
enum Demande {
    Pointer,
    Heures,
    Signaler,
    Admin,
    NouveauCodeAdmin,
    ConfirmerCodeAdmin,
}

#[derive(Clone, Copy, PartialEq, Debug)]
enum Edition {
    Modifier(i64),
    Supprimer(i64),
    Ajouter,
}

#[derive(Clone, Copy, PartialEq, Debug)]
enum CibleClavier {
    DetailSignalement,
    Prenom,
    Nom,
    Etablissement,
}

pub struct App {
    db: Db,
    ui: AppWindow,
    dossier: PathBuf,

    demande: Demande,
    code: String,
    nouveau_code_admin: String,
    /// Salarié identifié (confirmation, mes heures, signalement).
    salarie: Option<Salarie>,
    dernier_pointage: Option<i64>,
    categorie: String,

    derniere_activite: Instant,
    fin_notification: Option<Instant>,

    semaine: NaiveDate,
    detail: Option<(i64, NaiveDate)>,
    retour_detail: Ecran,
    edition: Option<Edition>,
    clavier: Option<CibleClavier>,
    signalement: i64,
    fiche: Salarie,
    attente_badge: bool,
    code_visible: bool,
}

fn modele<T: Clone + 'static>(v: Vec<T>) -> ModelRc<T> {
    ModelRc::new(VecModel::from(v))
}

fn maintenant() -> NaiveDateTime {
    Local::now().naive_local()
}

fn hm(t: NaiveDateTime) -> String {
    t.format("%H:%M").to_string()
}

/// « 08:00–12:00 · 13:30–… »
fn plages(heures: &[NaiveDateTime]) -> String {
    heures
        .chunks(2)
        .map(|p| match p {
            [a, b] => format!("{}–{}", hm(*a), hm(*b)),
            [a] => format!("{}–…", hm(*a)),
            _ => String::new(),
        })
        .collect::<Vec<_>>()
        .join("  ·  ")
}

fn libelle_categorie(c: &str) -> &'static str {
    match c {
        "oubli" => "Oubli de pointage",
        "erreur" => "Erreur de pointage",
        "badge" => "Badge",
        "materiel" => "Problème matériel",
        "securite" => "Sécurité / danger",
        _ => "Autre",
    }
}

fn libelle_statut(s: &str) -> &'static str {
    match s {
        "nouveau" => "Nouveau",
        "en_cours" => "En cours",
        "resolu" => "Résolu",
        "refuse" => "Refusé",
        _ => "",
    }
}

fn ajuster_heure(h: i32, m: i32, champ: &str, delta: i32, pas_minutes: i32) -> (i32, i32) {
    if champ == "h" {
        ((h + delta).rem_euclid(24), m)
    } else {
        let total = (h * 60 + m + delta * pas_minutes).rem_euclid(24 * 60);
        // Les minutes ne débordent pas sur l'heure : plus prévisible au doigt.
        (h, total % 60)
    }
}

impl App {
    pub fn new(db: Db, ui: AppWindow, dossier: PathBuf) -> App {
        let aujourd_hui = maintenant().date();
        let mut app = App {
            db,
            ui,
            dossier,
            demande: Demande::Pointer,
            code: String::new(),
            nouveau_code_admin: String::new(),
            salarie: None,
            dernier_pointage: None,
            categorie: String::new(),
            derniere_activite: Instant::now(),
            fin_notification: None,
            semaine: pointage::debut_semaine(aujourd_hui),
            detail: None,
            retour_detail: Ecran::Heures,
            edition: None,
            clavier: None,
            signalement: 0,
            fiche: Salarie::default(),
            attente_badge: false,
            code_visible: false,
        };
        let e = app.etat();
        e.set_etablissement(app.db.reglage("etablissement", "").into());
        e.set_sg_lieux(modele(
            LIEUX.iter().map(|l| SharedString::from(*l)).collect(),
        ));
        app.aller_accueil();
        app.tic();
        app
    }

    fn etat(&self) -> Etat<'_> {
        self.ui.global::<Etat>()
    }

    fn ecran(&self) -> Ecran {
        self.etat().get_ecran()
    }

    fn afficher(&self, ecran: Ecran) {
        self.etat().set_ecran(ecran);
        self.ui.invoke_reprendre_focus();
    }

    fn notifier(&mut self, texte: &str) {
        self.etat().set_notification(texte.into());
        self.fin_notification = Some(Instant::now() + Delai::from_secs(3));
    }

    fn delai_confirmation(&self) -> u64 {
        self.db
            .reglage("delai_confirmation", "4")
            .parse()
            .unwrap_or(4)
    }

    fn delai_double(&self) -> i64 {
        self.db.reglage("anti_double_min", "2").parse().unwrap_or(2)
    }

    fn code_admin(&self) -> String {
        self.db.reglage("code_admin", CODE_ADMIN_DEFAUT)
    }

    fn journaliser(&self, action: &str, motif: &str) {
        if let Err(e) = self.db.journaliser("Admin", action, motif) {
            eprintln!("journal : {e}");
        }
    }

    /// Délai d'inactivité avant retour automatique à l'accueil.
    fn delai_ecran(&self, ecran: Ecran) -> Option<u64> {
        match ecran {
            Ecran::Accueil => None,
            Ecran::Confirmation => Some(self.delai_confirmation()),
            Ecran::Message => Some(4),
            Ecran::Identification => Some(20),
            Ecran::MesHeures => Some(20),
            Ecran::Signaler | Ecran::SignalerOubli | Ecran::SignalerAutre => Some(90),
            _ => Some(180),
        }
    }

    /// Appelé chaque seconde : horloge, décompte, retour automatique.
    pub fn tic(&mut self) {
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        let n = maintenant();
        let heure: SharedString = hm(n).into();
        if e.get_heure() != heure {
            e.set_heure(heure);
            e.set_date(pointage::date_longue(n.date()).into());
        }
        if self.fin_notification.is_some_and(|f| Instant::now() >= f) {
            e.set_notification("".into());
            self.fin_notification = None;
        }

        let ecran = self.ecran();
        let ecoule = self.derniere_activite.elapsed().as_secs();
        if ecran == Ecran::Confirmation {
            e.set_conf_decompte(self.delai_confirmation().saturating_sub(ecoule) as i32);
        }
        if ecran == Ecran::Accueil && !self.code.is_empty() && ecoule >= 15 {
            self.code.clear();
            e.set_code_saisi(0);
        }
        // Pas de retour automatique pendant une saisie ou l'association d'un badge.
        let occupe = e.get_clavier_visible() || e.get_edition_visible() || self.attente_badge;
        if let Some(d) = self.delai_ecran(ecran)
            && ecoule >= d
            && !occupe
        {
            self.aller_accueil();
        }
    }

    pub fn action(&mut self, nom: &str, n: i32, texte: &str) {
        self.derniere_activite = Instant::now();
        let r = self.traiter(nom, n, texte);
        if let Err(err) = r {
            eprintln!("erreur ({nom}) : {err}");
            self.notifier(&format!("Erreur : {err}"));
        }
    }

    fn traiter(&mut self, nom: &str, n: i32, texte: &str) -> rusqlite::Result<()> {
        match nom {
            "accueil" => {
                if matches!(
                    self.demande,
                    Demande::NouveauCodeAdmin | Demande::ConfirmerCodeAdmin
                ) {
                    self.demande = Demande::Pointer;
                    self.ouvrir_admin("reglages")?;
                } else {
                    self.aller_accueil();
                }
            }
            "pave" => self.touche_pave(texte)?,
            "badge" => self.badge(texte)?,
            "demande" => {
                // Après « Déjà pointé », la personne est déjà identifiée.
                if texte == "signaler" && self.ecran() == Ecran::Message && self.salarie.is_some() {
                    self.ouvrir_signaler();
                } else {
                    self.identifier(if texte == "heures" {
                        Demande::Heures
                    } else {
                        Demande::Signaler
                    });
                }
            }
            "admin" => self.identifier(Demande::Admin),
            "conf" => match texte {
                "annuler" => self.annuler_pointage()?,
                "heures" => self.ouvrir_mes_heures()?,
                _ => self.ouvrir_signaler(),
            },
            "mh-periode" => {
                self.etat().set_mh_periode(n);
                self.ouvrir_mes_heures()?;
            }
            "sg-ouvrir" => self.ouvrir_signaler(),
            "sg-categorie" => self.choisir_categorie(texte),
            "sg-heure" => {
                let ui = self.ui.clone_strong();
                let e = ui.global::<Etat>();
                let (h, m) = ajuster_heure(e.get_sg_heure(), e.get_sg_minute(), texte, n, 5);
                e.set_sg_heure(h);
                e.set_sg_minute(m);
            }
            "sg-detail" => self.ouvrir_clavier(CibleClavier::DetailSignalement),
            "sg-envoyer" => self.envoyer_signalement()?,
            "clavier" => self.touche_clavier(texte),

            "aller" => self.ouvrir_admin(texte)?,
            "semaine" => {
                self.semaine += Duration::weeks(n as i64);
                self.charger_semaine()?;
            }
            "detail-semaine" => {
                let jour = self.jour_a_ouvrir(n as i64)?;
                self.ouvrir_detail(n as i64, jour, Ecran::Heures)?;
            }
            "detail-oubli" => {
                if let Ok(jour) = NaiveDate::parse_from_str(texte, "%Y-%m-%d") {
                    self.ouvrir_detail(n as i64, jour, Ecran::Oublis)?;
                }
            }
            "detail-jour" => {
                if let Some((id, jour)) = self.detail {
                    self.ouvrir_detail(id, jour + Duration::days(n as i64), self.retour_detail)?;
                }
            }
            "detail-retour" => {
                let retour = self.retour_detail;
                self.ouvrir_admin(match retour {
                    Ecran::Oublis => "oublis",
                    Ecran::Signalement => "signalements",
                    _ => "heures",
                })?;
            }
            "pt-modifier" => self.ouvrir_edition(Edition::Modifier(n as i64))?,
            "pt-supprimer" => self.ouvrir_edition(Edition::Supprimer(n as i64))?,
            "pt-ajouter" => self.ouvrir_edition(Edition::Ajouter)?,
            "ed-heure" => {
                let ui = self.ui.clone_strong();
                let e = ui.global::<Etat>();
                let (h, m) =
                    ajuster_heure(e.get_edition_heure(), e.get_edition_minute(), texte, n, 1);
                e.set_edition_heure(h);
                e.set_edition_minute(m);
            }
            "ed-annuler" => {
                self.edition = None;
                self.etat().set_edition_visible(false);
            }
            "ed-valider" => self.valider_edition()?,
            "demande-accepter" => self.traiter_demande(n as i64, true)?,
            "demande-refuser" => self.traiter_demande(n as i64, false)?,

            "sig-filtre" => {
                self.etat().set_sig_ouverts(n == 1);
                self.charger_signalements()?;
            }
            "signalement" => self.ouvrir_signalement(n as i64)?,
            "sd-accepter" => {
                self.traiter_demande(self.signalement, true)?;
                self.ouvrir_signalement(self.signalement)?;
            }
            "sd-refuser" => {
                self.traiter_demande(self.signalement, false)?;
                self.ouvrir_signalement(self.signalement)?;
            }
            "sd-journee" => {
                if let Some(s) = self.db.signalement(self.signalement)?
                    && let (Some(id), Some(jour)) = (s.salarie_id, s.demande_date)
                {
                    self.ouvrir_detail(id, jour, Ecran::Signalement)?;
                }
            }
            "sd-statut" => {
                self.db.changer_statut(self.signalement, texte)?;
                self.journaliser(
                    &format!(
                        "Signalement n°{} : {}",
                        self.signalement,
                        libelle_statut(texte)
                    ),
                    "",
                );
                self.ouvrir_signalement(self.signalement)?;
            }

            "sal-filtre" => {
                self.etat().set_sal_actifs(n == 1);
                self.charger_salaries()?;
            }
            "fiche" => self.ouvrir_fiche(n as i64)?,
            "fi-saisir" => self.ouvrir_clavier(if texte == "prenom" {
                CibleClavier::Prenom
            } else {
                CibleClavier::Nom
            }),
            "fi-badge" => {
                match n {
                    1 => self.attente_badge = true,
                    -1 => self.fiche.badge = None,
                    _ => self.attente_badge = false,
                }
                self.etat().set_fi_erreur("".into());
                self.afficher_fiche();
            }
            "fi-code" => {
                self.fiche.code = Some(self.db.nouveau_code()?);
                self.code_visible = true;
                self.afficher_fiche();
            }
            "fi-enregistrer" => self.enregistrer_fiche()?,

            "exporter" => self.exporter()?,
            "rg-code" => self.identifier(Demande::NouveauCodeAdmin),
            "rg-nom" => self.ouvrir_clavier(CibleClavier::Etablissement),
            "rg-double" => {
                self.db.definir_reglage("anti_double_min", &n.to_string())?;
                self.journaliser(&format!("Réglage anti double-badge : {n} min"), "");
                self.charger_reglages();
            }
            "rg-confirmation" => {
                self.db
                    .definir_reglage("delai_confirmation", &n.to_string())?;
                self.journaliser(&format!("Réglage durée de confirmation : {n} s"), "");
                self.charger_reglages();
            }
            autre => eprintln!("action inconnue : {autre}"),
        }
        Ok(())
    }

    // ================= Accueil, identification, pointage =================

    fn aller_accueil(&mut self) {
        self.reinitialiser();
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        e.set_code_saisi(0);
        e.set_code_longueur(4);
        e.set_clavier_visible(false);
        e.set_edition_visible(false);
        self.afficher(Ecran::Accueil);
    }

    fn reinitialiser(&mut self) {
        self.demande = Demande::Pointer;
        self.code.clear();
        self.salarie = None;
        self.dernier_pointage = None;
        self.attente_badge = false;
        self.edition = None;
        self.clavier = None;
    }

    fn identifier(&mut self, demande: Demande) {
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        self.reinitialiser();
        self.demande = demande;
        let (titre, consigne, longueur) = match demande {
            Demande::Heures => (
                "Mes heures",
                "Passez votre badge\nou tapez votre code".to_string(),
                4,
            ),
            Demande::Signaler => (
                "Signaler un problème",
                "Passez votre badge\nou tapez votre code".to_string(),
                4,
            ),
            Demande::Admin => {
                let mut c = "Code administrateur".to_string();
                if self.code_admin() == CODE_ADMIN_DEFAUT {
                    c += &format!(
                        "\n\n(code par défaut : {CODE_ADMIN_DEFAUT},\nà changer dans Réglages)"
                    );
                }
                ("Administration", c, 6)
            }
            Demande::NouveauCodeAdmin => (
                "Réglages",
                "Nouveau code administrateur\n(6 chiffres)".to_string(),
                6,
            ),
            Demande::ConfirmerCodeAdmin => (
                "Réglages",
                "Tapez à nouveau\nle nouveau code".to_string(),
                6,
            ),
            Demande::Pointer => ("", String::new(), 4),
        };
        e.set_pave_titre(titre.into());
        e.set_pave_consigne(consigne.into());
        e.set_code_longueur(longueur);
        e.set_code_saisi(0);
        self.afficher(Ecran::Identification);
    }

    fn touche_pave(&mut self, t: &str) -> rusqlite::Result<()> {
        let ecran = self.ecran();
        if ecran != Ecran::Accueil && ecran != Ecran::Identification {
            return Ok(());
        }
        if ecran == Ecran::Accueil {
            self.demande = Demande::Pointer;
        }
        let longueur = self.etat().get_code_longueur() as usize;
        match t {
            "del" => {
                self.code.pop();
            }
            "ok" => {}
            chiffre if self.code.len() < longueur => self.code.push_str(chiffre),
            _ => {}
        }
        self.etat().set_code_saisi(self.code.len() as i32);
        if self.code.len() == longueur || (t == "ok" && !self.code.is_empty()) {
            let code = std::mem::take(&mut self.code);
            self.etat().set_code_saisi(0);
            self.valider_code(&code)?;
        }
        Ok(())
    }

    fn valider_code(&mut self, code: &str) -> rusqlite::Result<()> {
        match self.demande {
            Demande::Admin => {
                if code == self.code_admin() {
                    self.reinitialiser();
                    self.ouvrir_admin("menu")?;
                } else {
                    self.notifier("Code administrateur incorrect");
                }
            }
            Demande::NouveauCodeAdmin => {
                if code.len() != 6 {
                    self.notifier("Le code doit faire 6 chiffres");
                } else {
                    self.nouveau_code_admin = code.to_string();
                    self.identifier(Demande::ConfirmerCodeAdmin);
                }
            }
            Demande::ConfirmerCodeAdmin => {
                if code == self.nouveau_code_admin {
                    self.db.definir_reglage("code_admin", code)?;
                    self.journaliser("Code administrateur modifié", "");
                    self.demande = Demande::Pointer;
                    self.ouvrir_admin("reglages")?;
                    self.notifier("✔ Nouveau code administrateur enregistré");
                } else {
                    self.identifier(Demande::NouveauCodeAdmin);
                    self.notifier("Les deux codes sont différents, recommencez");
                }
            }
            demande => match self.db.salarie_par_code(code)? {
                Some(s) => self.salarie_identifie(s, demande, "code")?,
                None => self.message(
                    3,
                    "Code incorrect",
                    "Vérifiez votre code ou adressez-vous à votre responsable.",
                    true,
                ),
            },
        }
        Ok(())
    }

    fn badge(&mut self, brut: &str) -> rusqlite::Result<()> {
        let badge = pointage::normaliser_badge(brut);
        if badge.is_empty() {
            return Ok(());
        }
        match self.ecran() {
            Ecran::Fiche if self.attente_badge => {
                self.attente_badge = false;
                match self.db.salarie_par_badge(&badge)? {
                    Some(autre) if autre.id != self.fiche.id => {
                        self.etat().set_fi_erreur(
                            format!("Ce badge appartient déjà à {}.", autre.nom_complet()).into(),
                        );
                    }
                    _ => {
                        self.fiche.badge = Some(badge);
                        self.etat().set_fi_erreur("".into());
                        self.notifier("✔ Badge lu — pensez à enregistrer");
                    }
                }
                self.afficher_fiche();
            }
            Ecran::Accueil | Ecran::Confirmation | Ecran::Message | Ecran::Identification => {
                let demande = if self.ecran() == Ecran::Identification {
                    self.demande
                } else {
                    Demande::Pointer
                };
                if matches!(
                    demande,
                    Demande::Admin | Demande::NouveauCodeAdmin | Demande::ConfirmerCodeAdmin
                ) {
                    return Ok(());
                }
                match self.db.salarie_par_badge(&badge)? {
                    Some(s) => self.salarie_identifie(s, demande, "badge")?,
                    None => {
                        self.reinitialiser();
                        self.message(
                            3,
                            "Badge inconnu",
                            "Adressez-vous à votre responsable.",
                            true,
                        )
                    }
                }
            }
            _ => {}
        }
        Ok(())
    }

    fn salarie_identifie(
        &mut self,
        s: Salarie,
        demande: Demande,
        source: &str,
    ) -> rusqlite::Result<()> {
        self.reinitialiser();
        if !s.actif {
            self.message(
                3,
                "Compte désactivé",
                "Adressez-vous à votre responsable.",
                false,
            );
            return Ok(());
        }
        self.salarie = Some(s.clone());
        match demande {
            Demande::Heures => self.ouvrir_mes_heures(),
            Demande::Signaler => {
                self.ouvrir_signaler();
                Ok(())
            }
            _ => self.pointer(s, source),
        }
    }

    fn message(&self, ton: i32, titre: &str, texte: &str, signaler: bool) {
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        e.set_msg_ton(ton);
        e.set_msg_titre(titre.into());
        e.set_msg_texte(texte.into());
        e.set_msg_signaler(signaler);
        self.afficher(Ecran::Message);
    }

    /// Totaux du jour et de la semaine pour un salarié, à l'instant `n`.
    fn totaux(&self, id: i64, n: NaiveDateTime) -> rusqlite::Result<(Duration, Duration)> {
        let lundi = pointage::debut_semaine(n.date());
        let pts = self.db.pointages(id, lundi, n.date())?;
        let mut jour = Duration::zero();
        let mut semaine = Duration::zero();
        let mut d = lundi;
        while d <= n.date() {
            let heures: Vec<_> = pts
                .iter()
                .filter(|p| p.horodatage.date() == d)
                .map(|p| p.horodatage)
                .collect();
            let j = pointage::calculer_journee(&heures, Some(n)).travaille;
            semaine += j;
            if d == n.date() {
                jour = j;
            }
            d = d.succ_opt().unwrap();
        }
        Ok((jour, semaine))
    }

    fn pointer(&mut self, s: Salarie, source: &str) -> rusqlite::Result<()> {
        let n = maintenant();
        if let Some(min) =
            pointage::trop_tot(self.db.dernier_pointage(s.id)?, n, self.delai_double())
        {
            let quand = if min == 0 {
                "à l'instant".to_string()
            } else {
                format!("il y a {min} min")
            };
            self.salarie = Some(s.clone());
            self.message(
                1,
                "Déjà pointé",
                &format!("{}, vous avez déjà pointé {quand}.", s.prenom),
                true,
            );
            return Ok(());
        }
        let du_jour = self.db.pointages(s.id, n.date(), n.date())?;
        let nature = Nature::depuis_index(du_jour.len());
        let id = self.db.ajouter_pointage(s.id, n, source)?;
        self.dernier_pointage = Some(id);
        let (jour, semaine) = self.totaux(s.id, n)?;

        let h = n.hour();
        let (ton, salut) = match nature {
            Nature::Arrivee => (0, format!("Bonjour {} !", s.prenom)),
            Nature::Retour => (0, format!("Bon retour {} !", s.prenom)),
            Nature::Depart if h >= 15 => (2, format!("Bonne soirée {} !", s.prenom)),
            Nature::Depart if h >= 11 => (1, format!("Bon appétit {} !", s.prenom)),
            Nature::Depart => (1, format!("À tout à l'heure {} !", s.prenom)),
        };
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        e.set_conf_ton(ton);
        e.set_conf_salut(salut.into());
        e.set_conf_action(format!("{}  à  {}", nature.libelle().to_uppercase(), hm(n)).into());
        e.set_conf_totaux(
            format!(
                "Aujourd'hui : {}   ·   Semaine : {}",
                pointage::format_duree(jour),
                pointage::format_duree(semaine)
            )
            .into(),
        );
        e.set_conf_decompte(self.delai_confirmation() as i32);
        self.salarie = Some(s);
        self.afficher(Ecran::Confirmation);
        Ok(())
    }

    fn annuler_pointage(&mut self) -> rusqlite::Result<()> {
        if let (Some(id), Some(s)) = (self.dernier_pointage.take(), self.salarie.clone())
            && let Some(p) = self.db.pointage(id)?
        {
            self.db.supprimer_pointage(id)?;
            self.db.journaliser(
                &s.nom_complet(),
                &format!(
                    "{} : pointage de {} annulé par le salarié",
                    s.nom_complet(),
                    hm(p.horodatage)
                ),
                "",
            )?;
            self.message(4, "Pointage annulé", "Vous pouvez badger à nouveau.", false);
        } else {
            self.aller_accueil();
        }
        Ok(())
    }

    // ================= Mes heures =================

    fn ouvrir_mes_heures(&mut self) -> rusqlite::Result<()> {
        let Some(s) = self.salarie.clone() else {
            self.aller_accueil();
            return Ok(());
        };
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        let n = maintenant();
        let aujourd_hui = n.date();
        let periode = e.get_mh_periode();
        let debut = match periode {
            0 => aujourd_hui,
            1 => pointage::debut_semaine(aujourd_hui),
            _ => pointage::debut_mois(aujourd_hui),
        };
        let pts = self.db.pointages(s.id, debut, aujourd_hui)?;
        let mut lignes = Vec::new();
        let mut total = Duration::zero();
        let mut d = debut;
        while d <= aujourd_hui {
            let heures: Vec<_> = pts
                .iter()
                .filter(|p| p.horodatage.date() == d)
                .map(|p| p.horodatage)
                .collect();
            let j = pointage::calculer_journee(&heures, Some(n));
            total += j.travaille;
            if periode == 0 {
                for (i, h) in heures.iter().enumerate() {
                    lignes.push(LigneJour {
                        titre: Nature::depuis_index(i).libelle().into(),
                        plages: hm(*h).into(),
                        total: "".into(),
                        alerte: false,
                    });
                }
                if heures.is_empty() {
                    lignes.push(LigneJour {
                        titre: "".into(),
                        plages: "Aucun pointage aujourd'hui".into(),
                        total: "".into(),
                        alerte: false,
                    });
                }
            } else if !heures.is_empty() || (periode == 1 && d.weekday().num_days_from_monday() < 5)
            {
                lignes.push(LigneJour {
                    titre: pointage::date_courte(d).into(),
                    plages: if heures.is_empty() {
                        "—".into()
                    } else {
                        plages(&heures).into()
                    },
                    total: if j.en_cours {
                        format!("{} …", pointage::format_duree_court(j.travaille)).into()
                    } else {
                        pointage::format_duree_court(j.travaille).into()
                    },
                    alerte: j.incomplete,
                });
            }
            d = d.succ_opt().unwrap();
        }
        let libelle = ["Aujourd'hui", "Cette semaine", "Ce mois-ci"][periode.clamp(0, 2) as usize];
        e.set_mh_nom(s.nom_complet().into());
        e.set_mh_lignes(modele(lignes));
        e.set_mh_resume(format!("{libelle} : {}", pointage::format_duree(total)).into());
        self.afficher(Ecran::MesHeures);
        Ok(())
    }

    // ================= Signalements (côté salarié) =================

    fn ouvrir_signaler(&mut self) {
        match &self.salarie {
            Some(s) => {
                self.etat().set_sg_nom(s.nom_complet().into());
                self.afficher(Ecran::Signaler);
            }
            None => self.identifier(Demande::Signaler),
        }
    }

    fn choisir_categorie(&mut self, categorie: &str) {
        self.categorie = categorie.to_string();
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        e.set_sg_titre(libelle_categorie(categorie).into());
        if categorie == "oubli" || categorie == "erreur" {
            let n = maintenant();
            e.set_sg_jour(0);
            e.set_sg_nature(0);
            e.set_sg_motif(if categorie == "oubli" { 0 } else { 2 });
            e.set_sg_heure(n.hour() as i32);
            e.set_sg_minute((n.minute() as i32 / 5) * 5);
            self.afficher(Ecran::SignalerOubli);
        } else {
            e.set_sg_lieu(-1);
            e.set_sg_urgence(if categorie == "securite" { 1 } else { 0 });
            e.set_sg_detail("".into());
            e.set_sg_montre_lieu(categorie != "badge");
            e.set_sg_anonyme_possible(categorie == "securite");
            e.set_sg_anonyme(false);
            self.afficher(Ecran::SignalerAutre);
        }
    }

    fn envoyer_signalement(&mut self) -> rusqlite::Result<()> {
        let Some(s) = self.salarie.clone() else {
            self.aller_accueil();
            return Ok(());
        };
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        let mut sig = Signalement {
            categorie: self.categorie.clone(),
            ..Default::default()
        };
        if self.ecran() == Ecran::SignalerOubli {
            let jour = maintenant().date() - Duration::days(e.get_sg_jour() as i64);
            sig.salarie_id = Some(s.id);
            sig.demande_date = Some(jour);
            sig.demande_heure =
                NaiveTime::from_hms_opt(e.get_sg_heure() as u32, e.get_sg_minute() as u32, 0);
            sig.demande_nature =
                ["Arrivée", "Départ", "Retour"][e.get_sg_nature().clamp(0, 2) as usize].into();
            sig.motif = MOTIFS_OUBLI[e.get_sg_motif().clamp(0, 2) as usize].into();
        } else {
            let anonyme = e.get_sg_anonyme_possible() && e.get_sg_anonyme();
            sig.salarie_id = if anonyme { None } else { Some(s.id) };
            let lieu = e.get_sg_lieu();
            if e.get_sg_montre_lieu() && lieu >= 0 {
                sig.lieu = e
                    .get_sg_lieux()
                    .row_data(lieu as usize)
                    .unwrap_or_default()
                    .into();
            }
            sig.urgence = e.get_sg_urgence();
            sig.detail = e.get_sg_detail().trim().to_string();
        }
        self.db.ajouter_signalement(&sig)?;
        self.reinitialiser();
        self.message(
            0,
            "✔ Merci !",
            "Votre signalement a été transmis à votre responsable.",
            false,
        );
        Ok(())
    }

    // ================= Clavier tactile =================

    fn ouvrir_clavier(&mut self, cible: CibleClavier) {
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        let (titre, texte) = match cible {
            CibleClavier::DetailSignalement => ("Détail", e.get_sg_detail().to_string()),
            CibleClavier::Prenom => ("Prénom", self.fiche.prenom.clone()),
            CibleClavier::Nom => ("Nom", self.fiche.nom.clone()),
            CibleClavier::Etablissement => ("Établissement", e.get_etablissement().to_string()),
        };
        self.clavier = Some(cible);
        e.set_clavier_titre(titre.into());
        e.set_clavier_texte(texte.clone().into());
        // Majuscule automatique en début de nom.
        e.set_clavier_maj(texte.is_empty());
        e.set_clavier_visible(true);
    }

    fn touche_clavier(&mut self, t: &str) {
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        let mut texte = e.get_clavier_texte().to_string();
        match t {
            "annuler" => {
                self.clavier = None;
                e.set_clavier_visible(false);
                return;
            }
            "ok" => {
                let valeur = texte.trim().to_string();
                match self.clavier.take() {
                    Some(CibleClavier::DetailSignalement) => e.set_sg_detail(valeur.into()),
                    Some(CibleClavier::Prenom) => self.fiche.prenom = valeur,
                    Some(CibleClavier::Nom) => self.fiche.nom = valeur,
                    Some(CibleClavier::Etablissement) => {
                        if let Err(err) = self.db.definir_reglage("etablissement", &valeur) {
                            eprintln!("{err}");
                        }
                        self.journaliser(&format!("Nom de l'établissement : « {valeur} »"), "");
                        e.set_etablissement(valeur.into());
                    }
                    None => {}
                }
                e.set_clavier_visible(false);
                if self.ecran() == Ecran::Fiche {
                    self.afficher_fiche();
                }
                return;
            }
            "del" => {
                texte.pop();
            }
            "maj" => {
                e.set_clavier_maj(!e.get_clavier_maj());
                return;
            }
            "espace" => texte.push(' '),
            c => {
                if texte.chars().count() < 200 {
                    texte.push_str(c);
                }
                if e.get_clavier_maj() {
                    e.set_clavier_maj(false);
                }
            }
        }
        if matches!(self.clavier, Some(CibleClavier::Prenom | CibleClavier::Nom))
            && (texte.ends_with(' ') || texte.ends_with('-'))
        {
            e.set_clavier_maj(true);
        }
        e.set_clavier_texte(texte.into());
    }

    // ================= Administration =================

    fn ouvrir_admin(&mut self, ecran: &str) -> rusqlite::Result<()> {
        self.attente_badge = false;
        match ecran {
            "presents" => {
                self.charger_presents()?;
                self.afficher(Ecran::Presents);
            }
            "heures" => {
                self.charger_semaine()?;
                self.afficher(Ecran::Heures);
            }
            "oublis" => {
                self.charger_oublis()?;
                self.afficher(Ecran::Oublis);
            }
            "signalements" => {
                self.charger_signalements()?;
                self.afficher(Ecran::Signalements);
            }
            "salaries" => {
                self.charger_salaries()?;
                self.afficher(Ecran::Salaries);
            }
            "export" => {
                self.etat().set_ex_resultat("".into());
                self.afficher(Ecran::Export);
            }
            "journal" => {
                let lignes = self
                    .db
                    .journal(300)?
                    .into_iter()
                    .map(|j| LigneJournal {
                        quand: j.horodatage.format("%d/%m %H:%M").to_string().into(),
                        auteur: j.auteur.into(),
                        action: j.action.into(),
                        motif: j.motif.into(),
                    })
                    .collect();
                self.etat().set_journal(modele(lignes));
                self.afficher(Ecran::Journal);
            }
            "reglages" => {
                self.charger_reglages();
                self.afficher(Ecran::Reglages);
            }
            _ => {
                self.charger_compteurs()?;
                self.afficher(Ecran::AdminMenu);
            }
        }
        Ok(())
    }

    fn charger_compteurs(&self) -> rusqlite::Result<()> {
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        let n = maintenant();
        let salaries = self.db.salaries(true)?;
        let mut presents = 0;
        for s in &salaries {
            if self.db.pointages(s.id, n.date(), n.date())?.len() % 2 == 1 {
                presents += 1;
            }
        }
        e.set_nb_presents(presents);
        e.set_nb_salaries(salaries.len() as i32);
        e.set_nb_oublis(self.liste_oublis()?.len() as i32);
        e.set_nb_signalements(self.db.nb_signalements_nouveaux()? as i32);
        Ok(())
    }

    fn charger_presents(&self) -> rusqlite::Result<()> {
        let n = maintenant();
        let mut lignes = Vec::new();
        let mut presents = 0;
        let salaries = self.db.salaries(true)?;
        for s in &salaries {
            let heures: Vec<_> = self
                .db
                .pointages(s.id, n.date(), n.date())?
                .into_iter()
                .map(|p| p.horodatage)
                .collect();
            let j = pointage::calculer_journee(&heures, Some(n));
            let total = format!("jour : {}", pointage::format_duree(j.travaille));
            let (ordre, ligne) = match heures.last() {
                None => (
                    2,
                    LignePresent {
                        nom: s.nom_complet().into(),
                        etat: "Pas encore pointé".into(),
                        detail: "".into(),
                        ton: 4,
                    },
                ),
                Some(h) if heures.len() % 2 == 1 => {
                    presents += 1;
                    (
                        0,
                        LignePresent {
                            nom: s.nom_complet().into(),
                            etat: format!("Présent depuis {}", hm(*h)).into(),
                            detail: total.into(),
                            ton: 0,
                        },
                    )
                }
                Some(h) => (
                    1,
                    LignePresent {
                        nom: s.nom_complet().into(),
                        etat: format!("Sorti à {}", hm(*h)).into(),
                        detail: total.into(),
                        ton: 1,
                    },
                ),
            };
            lignes.push((ordre, ligne));
        }
        lignes.sort_by_key(|(o, _)| *o);
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        e.set_nb_presents(presents);
        e.set_nb_salaries(salaries.len() as i32);
        e.set_presents(modele(lignes.into_iter().map(|(_, l)| l).collect()));
        Ok(())
    }

    fn charger_semaine(&self) -> rusqlite::Result<()> {
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        let n = maintenant();
        let lundi = self.semaine;
        let dimanche = lundi + Duration::days(6);
        e.set_semaine_titre(
            format!(
                "Semaine du {} {} au {} {} {}",
                lundi.day(),
                &pointage::nom_mois(lundi.month())[..],
                dimanche.day(),
                pointage::nom_mois(dimanche.month()),
                dimanche.year()
            )
            .into(),
        );
        let jours: Vec<SharedString> = (0..7)
            .map(|i| {
                let d = lundi + Duration::days(i);
                format!("{} {}", &pointage::nom_jour(d.weekday())[..3], d.day()).into()
            })
            .collect();
        e.set_semaine_jours(modele(jours));

        let mut lignes = Vec::new();
        for s in self.db.salaries(true)? {
            let pts = self.db.pointages(s.id, lundi, dimanche)?;
            let mut total = Duration::zero();
            let mut alerte = false;
            let mut cellules = Vec::new();
            for i in 0..7 {
                let d = lundi + Duration::days(i);
                let heures: Vec<_> = pts
                    .iter()
                    .filter(|p| p.horodatage.date() == d)
                    .map(|p| p.horodatage)
                    .collect();
                let j = pointage::calculer_journee(&heures, Some(n));
                total += j.travaille;
                alerte |= j.incomplete;
                cellules.push(SharedString::from(if j.incomplete {
                    "⚠".to_string()
                } else if heures.is_empty() {
                    "".to_string()
                } else {
                    pointage::format_duree_court(j.travaille)
                }));
            }
            lignes.push(LigneSemaine {
                id: s.id as i32,
                nom: s.nom_complet().into(),
                jours: modele(cellules),
                total: pointage::format_duree_court(total).into(),
                alerte,
            });
        }
        e.set_semaine(modele(lignes));
        Ok(())
    }

    /// Jour à ouvrir depuis la vue semaine : le premier oubli, sinon aujourd'hui
    /// s'il est dans la semaine, sinon le lundi.
    fn jour_a_ouvrir(&self, id: i64) -> rusqlite::Result<NaiveDate> {
        let n = maintenant();
        let lundi = self.semaine;
        let pts = self.db.pointages(id, lundi, lundi + Duration::days(6))?;
        for i in 0..7 {
            let d = lundi + Duration::days(i);
            let heures: Vec<_> = pts
                .iter()
                .filter(|p| p.horodatage.date() == d)
                .map(|p| p.horodatage)
                .collect();
            if pointage::calculer_journee(&heures, Some(n)).incomplete {
                return Ok(d);
            }
        }
        let aujourd_hui = n.date();
        Ok(
            if aujourd_hui >= lundi && aujourd_hui <= lundi + Duration::days(6) {
                aujourd_hui
            } else {
                lundi
            },
        )
    }

    /// Journées incomplètes (31 derniers jours, hors aujourd'hui) et demandes en attente.
    fn liste_oublis(&self) -> rusqlite::Result<Vec<LigneOubli>> {
        let n = maintenant();
        let debut = n.date() - Duration::days(31);
        let mut lignes = Vec::new();
        for s in self.db.salaries(true)? {
            let pts = self.db.pointages(s.id, debut, n.date())?;
            let demandes = self.db.demandes_en_attente(s.id)?;
            let mut jours: Vec<NaiveDate> = pts.iter().map(|p| p.horodatage.date()).collect();
            jours.extend(demandes.iter().filter_map(|d| d.demande_date));
            jours.sort();
            jours.dedup();
            for d in jours {
                let heures: Vec<_> = pts
                    .iter()
                    .filter(|p| p.horodatage.date() == d)
                    .map(|p| p.horodatage)
                    .collect();
                let j = pointage::calculer_journee(&heures, Some(n));
                let demande = demandes.iter().any(|x| x.demande_date == Some(d));
                if j.incomplete || demande {
                    let texte = if j.incomplete {
                        format!("{} manquant", Nature::depuis_index(heures.len()).libelle())
                    } else {
                        "Correction demandée".into()
                    };
                    lignes.push(LigneOubli {
                        salarie: s.id as i32,
                        date: d.format("%Y-%m-%d").to_string().into(),
                        nom: s.nom_complet().into(),
                        jour: pointage::date_courte(d).into(),
                        texte: texte.into(),
                        demande,
                    });
                }
            }
        }
        lignes.sort_by(|a, b| b.date.cmp(&a.date));
        Ok(lignes)
    }

    fn charger_oublis(&self) -> rusqlite::Result<()> {
        self.etat().set_oublis(modele(self.liste_oublis()?));
        Ok(())
    }

    fn ouvrir_detail(&mut self, id: i64, jour: NaiveDate, retour: Ecran) -> rusqlite::Result<()> {
        let Some(s) = self.db.salarie(id)? else {
            return Ok(());
        };
        self.detail = Some((id, jour));
        self.retour_detail = retour;
        let n = maintenant();
        let pts = self.db.pointages(id, jour, jour)?;
        let heures: Vec<_> = pts.iter().map(|p| p.horodatage).collect();
        let j = pointage::calculer_journee(&heures, Some(n));
        let lignes = pts
            .iter()
            .enumerate()
            .map(|(i, p)| LignePointage {
                id: p.id as i32,
                nature: Nature::depuis_index(i).libelle().into(),
                heure: hm(p.horodatage).into(),
                note: match p.source.as_str() {
                    "admin" => "ajouté par admin",
                    "demande" => "demande acceptée",
                    "code" => "par code",
                    _ => "",
                }
                .into(),
            })
            .collect();
        let demandes = self
            .db
            .demandes_en_attente(id)?
            .into_iter()
            .filter(|d| d.demande_date == Some(jour))
            .map(|d| LigneDemande {
                id: d.id as i32,
                texte: format!(
                    "{} : {} à {}\n({})",
                    libelle_categorie(&d.categorie),
                    d.demande_nature,
                    d.demande_heure
                        .map(|h| h.format("%H:%M").to_string())
                        .unwrap_or_default(),
                    d.motif
                )
                .into(),
            })
            .collect();
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        e.set_det_titre(format!("{} — {}", s.nom_complet(), pointage::date_longue(jour)).into());
        e.set_det_pointages(modele(lignes));
        e.set_det_alerte(if j.incomplete {
            format!("{} manquant", Nature::depuis_index(heures.len()).libelle()).into()
        } else if heures.is_empty() {
            "Aucun pointage ce jour".into()
        } else {
            "".into()
        });
        e.set_det_total(
            format!(
                "{}{}",
                pointage::format_duree(j.travaille),
                if j.incomplete { " + ?" } else { "" }
            )
            .into(),
        );
        e.set_det_demandes(modele(demandes));
        self.afficher(Ecran::Detail);
        Ok(())
    }

    fn ouvrir_edition(&mut self, edition: Edition) -> rusqlite::Result<()> {
        let Some((_, jour)) = self.detail else {
            return Ok(());
        };
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        let (titre, heure, motifs, bouton, danger): (
            String,
            Option<NaiveDateTime>,
            &[&str],
            &str,
            bool,
        ) = match edition {
            Edition::Modifier(id) => {
                let Some(p) = self.db.pointage(id)? else {
                    return Ok(());
                };
                (
                    format!("Modifier le pointage de {}", hm(p.horodatage)),
                    Some(p.horodatage),
                    &MOTIFS_MODIF,
                    "✔ Enregistrer",
                    false,
                )
            }
            Edition::Supprimer(id) => {
                let Some(p) = self.db.pointage(id)? else {
                    return Ok(());
                };
                (
                    format!("Supprimer le pointage de {} ?", hm(p.horodatage)),
                    None,
                    &MOTIFS_SUPPR,
                    "Supprimer",
                    true,
                )
            }
            Edition::Ajouter => {
                let n = maintenant();
                let defaut = if jour == n.date() {
                    n
                } else {
                    jour.and_hms_opt(12, 0, 0).unwrap()
                };
                (
                    format!("Ajouter un pointage — {}", pointage::date_courte(jour)),
                    Some(defaut),
                    &MOTIFS_MODIF,
                    "✔ Ajouter",
                    false,
                )
            }
        };
        self.edition = Some(edition);
        e.set_edition_titre(titre.into());
        e.set_edition_heure_visible(heure.is_some());
        if let Some(h) = heure {
            e.set_edition_heure(h.hour() as i32);
            e.set_edition_minute(h.minute() as i32);
        }
        e.set_edition_motifs(modele(
            motifs.iter().map(|m| SharedString::from(*m)).collect(),
        ));
        e.set_edition_motif(-1);
        e.set_edition_bouton(bouton.into());
        e.set_edition_danger(danger);
        e.set_edition_visible(true);
        Ok(())
    }

    fn valider_edition(&mut self) -> rusqlite::Result<()> {
        let (Some(edition), Some((id_salarie, jour))) = (self.edition, self.detail) else {
            return Ok(());
        };
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        let motif_index = e.get_edition_motif();
        if motif_index < 0 {
            return Ok(());
        }
        let motif = e
            .get_edition_motifs()
            .row_data(motif_index as usize)
            .unwrap_or_default()
            .to_string();
        let heure = NaiveTime::from_hms_opt(
            e.get_edition_heure() as u32,
            e.get_edition_minute() as u32,
            0,
        )
        .unwrap();
        let nom = self
            .db
            .salarie(id_salarie)?
            .map(|s| s.nom_complet())
            .unwrap_or_default();
        let jour_txt = pointage::date_courte(jour);
        match edition {
            Edition::Modifier(id) => {
                if let Some(p) = self.db.pointage(id)? {
                    let nouveau = jour.and_time(heure);
                    self.db.modifier_pointage(id, nouveau)?;
                    self.journaliser(
                        &format!(
                            "{nom}, {jour_txt} : pointage {} → {}",
                            hm(p.horodatage),
                            hm(nouveau)
                        ),
                        &motif,
                    );
                }
            }
            Edition::Supprimer(id) => {
                if let Some(p) = self.db.pointage(id)? {
                    self.db.supprimer_pointage(id)?;
                    self.journaliser(
                        &format!("{nom}, {jour_txt} : pointage {} supprimé", hm(p.horodatage)),
                        &motif,
                    );
                }
            }
            Edition::Ajouter => {
                let quand = jour.and_time(heure);
                self.db.ajouter_pointage(id_salarie, quand, "admin")?;
                self.journaliser(
                    &format!("{nom}, {jour_txt} : pointage {} ajouté", hm(quand)),
                    &motif,
                );
            }
        }
        self.edition = None;
        e.set_edition_visible(false);
        self.ouvrir_detail(id_salarie, jour, self.retour_detail)?;
        self.notifier("✔ Enregistré");
        Ok(())
    }

    /// Accepte (ajoute le pointage demandé) ou refuse une demande de correction.
    fn traiter_demande(&mut self, id: i64, accepter: bool) -> rusqlite::Result<()> {
        let Some(d) = self.db.signalement(id)? else {
            return Ok(());
        };
        let nom = match d.salarie_id {
            Some(s) => self
                .db
                .salarie(s)?
                .map(|s| s.nom_complet())
                .unwrap_or_default(),
            None => String::new(),
        };
        let quand = d
            .demande_date
            .zip(d.demande_heure)
            .map(|(j, h)| j.and_time(h));
        if accepter {
            if let (Some(s), Some(q)) = (d.salarie_id, quand) {
                self.db.ajouter_pointage(s, q, "demande")?;
            }
            self.db.changer_statut(id, "resolu")?;
        } else {
            self.db.changer_statut(id, "refuse")?;
        }
        let txt = quand
            .map(|q| format!("{} {}", pointage::date_courte(q.date()), hm(q)))
            .unwrap_or_default();
        self.journaliser(
            &format!(
                "{nom} : demande « {} {txt} » {}",
                d.demande_nature,
                if accepter {
                    "acceptée, pointage ajouté"
                } else {
                    "refusée"
                }
            ),
            &d.motif,
        );
        if self.ecran() == Ecran::Detail
            && let Some((s, jour)) = self.detail
        {
            self.ouvrir_detail(s, jour, self.retour_detail)?;
        }
        if accepter && d.categorie == "erreur" {
            self.notifier("Pensez à supprimer le pointage erroné");
        } else {
            self.notifier(if accepter {
                "✔ Demande acceptée"
            } else {
                "Demande refusée"
            });
        }
        Ok(())
    }

    fn charger_signalements(&self) -> rusqlite::Result<()> {
        let ouverts = self.etat().get_sig_ouverts();
        let mut lignes = Vec::new();
        for s in self.db.signalements(ouverts)? {
            let qui = match s.salarie_id {
                Some(id) => self
                    .db
                    .salarie(id)?
                    .map(|x| x.nom_complet())
                    .unwrap_or_default(),
                None => "Anonyme".into(),
            };
            let demande = s.categorie == "oubli" || s.categorie == "erreur";
            let resume = if demande {
                format!(
                    "{} {} à {}",
                    s.demande_nature,
                    s.demande_date
                        .map(pointage::date_courte)
                        .unwrap_or_default(),
                    s.demande_heure
                        .map(|h| h.format("%H:%M").to_string())
                        .unwrap_or_default()
                )
            } else {
                [s.lieu.as_str(), s.detail.as_str()]
                    .iter()
                    .filter(|x| !x.is_empty())
                    .cloned()
                    .collect::<Vec<_>>()
                    .join(" — ")
            };
            lignes.push(LigneSignalement {
                id: s.id as i32,
                ton: if demande {
                    2
                } else {
                    [0, 1, 3][s.urgence.clamp(0, 2) as usize]
                },
                quand: s
                    .cree_le
                    .map(|c| c.format("%d/%m %H:%M").to_string())
                    .unwrap_or_default()
                    .into(),
                categorie: libelle_categorie(&s.categorie).into(),
                qui: qui.into(),
                resume: resume.into(),
            });
        }
        self.etat().set_signalements(modele(lignes));
        Ok(())
    }

    fn ouvrir_signalement(&mut self, id: i64) -> rusqlite::Result<()> {
        let Some(s) = self.db.signalement(id)? else {
            return Ok(());
        };
        self.signalement = id;
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        let qui = match s.salarie_id {
            Some(sid) => self
                .db
                .salarie(sid)?
                .map(|x| x.nom_complet())
                .unwrap_or_default(),
            None => "Anonyme".into(),
        };
        let demande = s.categorie == "oubli" || s.categorie == "erreur";
        e.set_sd_titre(libelle_categorie(&s.categorie).into());
        e.set_sd_qui(qui.into());
        e.set_sd_quand(
            s.cree_le
                .map(|c| {
                    format!(
                        "Signalé le {} à {}",
                        c.format("%d/%m/%Y"),
                        c.format("%H:%M")
                    )
                })
                .unwrap_or_default()
                .into(),
        );
        if demande {
            e.set_sd_infos(
                format!(
                    "Demande : {} à {}, le {}\nMotif : {}",
                    s.demande_nature,
                    s.demande_heure
                        .map(|h| h.format("%H:%M").to_string())
                        .unwrap_or_default(),
                    s.demande_date
                        .map(pointage::date_longue)
                        .unwrap_or_default(),
                    s.motif
                )
                .into(),
            );
        } else {
            let mut infos = format!("Urgence : {}", URGENCES[s.urgence.clamp(0, 2) as usize]);
            if !s.lieu.is_empty() {
                infos = format!("Lieu : {}   ·   {infos}", s.lieu);
            }
            e.set_sd_infos(infos.into());
        }
        e.set_sd_detail(if s.detail.is_empty() {
            "".into()
        } else {
            format!("« {} »", s.detail).into()
        });
        e.set_sd_statut(libelle_statut(&s.statut).into());
        e.set_sd_demande(demande);
        e.set_sd_ouvert(s.statut == "nouveau" || s.statut == "en_cours");
        self.afficher(Ecran::Signalement);
        Ok(())
    }

    fn charger_salaries(&self) -> rusqlite::Result<()> {
        let actifs = self.etat().get_sal_actifs();
        let lignes = self
            .db
            .salaries(actifs)?
            .into_iter()
            .map(|s| LigneSalarie {
                id: s.id as i32,
                nom: s.nom_complet().into(),
                badge: s.badge.is_some(),
                code: s.code.is_some(),
            })
            .collect();
        self.etat().set_salaries(modele(lignes));
        Ok(())
    }

    fn ouvrir_fiche(&mut self, id: i64) -> rusqlite::Result<()> {
        self.attente_badge = false;
        self.code_visible = false;
        if id == 0 {
            self.fiche = Salarie {
                actif: true,
                code: Some(self.db.nouveau_code()?),
                ..Default::default()
            };
            self.code_visible = true;
        } else {
            let Some(s) = self.db.salarie(id)? else {
                return Ok(());
            };
            self.fiche = s;
        }
        self.etat().set_fi_erreur("".into());
        self.etat().set_fi_actif(self.fiche.actif);
        self.afficher_fiche();
        self.afficher(Ecran::Fiche);
        Ok(())
    }

    fn afficher_fiche(&self) {
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        let f = &self.fiche;
        e.set_fi_titre(if f.id == 0 {
            "Nouveau salarié".into()
        } else {
            f.nom_complet().into()
        });
        e.set_fi_prenom(f.prenom.clone().into());
        e.set_fi_nom(f.nom.clone().into());
        e.set_fi_badge(f.badge.clone().unwrap_or_else(|| "Aucun".into()).into());
        e.set_fi_code(
            match (&f.code, self.code_visible) {
                (Some(c), true) => format!("{c}   (à communiquer au salarié)"),
                (Some(_), false) => "● ● ● ●   (défini)".into(),
                (None, _) => "Aucun".into(),
            }
            .into(),
        );
        e.set_fi_attente_badge(self.attente_badge);
    }

    fn enregistrer_fiche(&mut self) -> rusqlite::Result<()> {
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        self.fiche.actif = e.get_fi_actif();
        if self.fiche.prenom.trim().is_empty() && self.fiche.nom.trim().is_empty() {
            e.set_fi_erreur("Indiquez au moins un prénom ou un nom.".into());
            return Ok(());
        }
        if self.fiche.badge.is_none() && self.fiche.code.is_none() {
            e.set_fi_erreur("Il faut un badge ou un code pour pouvoir pointer.".into());
            return Ok(());
        }
        let nouveau = self.fiche.id == 0;
        let avant = if nouveau {
            None
        } else {
            self.db.salarie(self.fiche.id)?
        };
        match self.db.enregistrer_salarie(&self.fiche) {
            Ok(_) => {}
            Err(rusqlite::Error::SqliteFailure(err, _))
                if err.code == rusqlite::ErrorCode::ConstraintViolation =>
            {
                e.set_fi_erreur(
                    "Ce badge ou ce code est déjà utilisé par un autre salarié.".into(),
                );
                return Ok(());
            }
            Err(err) => return Err(err),
        }
        let nom = self.fiche.nom_complet();
        if nouveau {
            self.journaliser(&format!("Salarié créé : {nom}"), "");
        } else if let Some(a) = avant {
            let mut changes = Vec::new();
            if a.nom_complet() != nom {
                changes.push(format!("nom « {} »", a.nom_complet()));
            }
            if a.badge != self.fiche.badge {
                changes.push("badge".to_string());
            }
            if a.code != self.fiche.code {
                changes.push("code".to_string());
            }
            if a.actif != self.fiche.actif {
                changes.push(
                    if self.fiche.actif {
                        "réactivé"
                    } else {
                        "désactivé"
                    }
                    .to_string(),
                );
            }
            if !changes.is_empty() {
                self.journaliser(
                    &format!("Fiche {nom} modifiée : {}", changes.join(", ")),
                    "",
                );
            }
        }
        self.ouvrir_admin("salaries")?;
        self.notifier("✔ Salarié enregistré");
        Ok(())
    }

    fn exporter(&mut self) -> rusqlite::Result<()> {
        let aujourd_hui = maintenant().date();
        let lundi = pointage::debut_semaine(aujourd_hui);
        let mois = pointage::debut_mois(aujourd_hui);
        let (du, au) = match self.etat().get_ex_periode() {
            0 => (lundi, lundi + Duration::days(6)),
            1 => (lundi - Duration::days(7), lundi - Duration::days(1)),
            2 => (mois, pointage::mois_suivant(mois) - Duration::days(1)),
            _ => {
                let fin = mois - Duration::days(1);
                (pointage::debut_mois(fin), fin)
            }
        };
        let resultat = match export::exporter_csv(&self.db, du, au, &self.dossier) {
            Ok((chemin, lignes)) => {
                self.journaliser(
                    &format!(
                        "Export CSV du {} au {} ({lignes} lignes)",
                        du.format("%d/%m"),
                        au.format("%d/%m")
                    ),
                    "",
                );
                format!("✔ {lignes} lignes exportées dans :\n{}", chemin.display())
            }
            Err(err) => format!("✖ Export impossible : {err}"),
        };
        self.etat().set_ex_resultat(resultat.into());
        Ok(())
    }

    fn charger_reglages(&self) {
        let ui = self.ui.clone_strong();
        let e = ui.global::<Etat>();
        e.set_rg_double(self.delai_double() as i32);
        e.set_rg_confirmation(self.delai_confirmation() as i32);
        let defaut = if self.code_admin() == CODE_ADMIN_DEFAUT {
            "\n⚠ Le code administrateur est encore celui par défaut : changez-le."
        } else {
            ""
        };
        e.set_rg_infos(
            format!(
                "Version {}  ·  Données : {}{defaut}",
                env!("CARGO_PKG_VERSION"),
                self.dossier.join("badgeuse.db").display()
            )
            .into(),
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plages_affichees() {
        let d = NaiveDate::from_ymd_opt(2026, 10, 2).unwrap();
        let h = |hh, mm| d.and_hms_opt(hh, mm, 0).unwrap();
        assert_eq!(
            plages(&[h(8, 0), h(12, 0), h(13, 30)]),
            "08:00–12:00  ·  13:30–…"
        );
    }

    #[test]
    fn molette_heure() {
        assert_eq!(ajuster_heure(23, 0, "h", 1, 1), (0, 0));
        assert_eq!(ajuster_heure(8, 55, "m", 1, 5), (8, 0));
        assert_eq!(ajuster_heure(8, 0, "m", -1, 1), (8, 59));
    }
}

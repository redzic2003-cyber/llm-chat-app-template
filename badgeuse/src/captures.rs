//! Mode développeur (`--captures DOSSIER`, avec `--demo`) : joue un scénario
//! et enregistre une image brute RGBA de chaque écran, pour la documentation.
//! Conversion : `convert -size LxH -depth 8 rgba:fichier.rgba fichier.png`.

use std::cell::RefCell;
use std::path::PathBuf;
use std::rc::Rc;
use std::time::Duration;

use slint::{ComponentHandle, Model};

use crate::app::App;
use crate::{AppWindow, Etat};

type Etape = (&'static str, Box<dyn Fn(&mut App, &AppWindow)>);

fn a(nom: &'static str, n: i32, t: &'static str) -> impl Fn(&mut App, &AppWindow) {
    move |app: &mut App, _: &AppWindow| app.action(nom, n, t)
}

fn suite(actions: Vec<(&'static str, i32, &'static str)>) -> Box<dyn Fn(&mut App, &AppWindow)> {
    Box::new(move |app: &mut App, _: &AppWindow| {
        for (nom, n, t) in &actions {
            app.action(nom, *n, t);
        }
    })
}

fn scenario() -> Vec<Etape> {
    vec![
        ("01-accueil", Box::new(a("accueil", 0, ""))),
        (
            "02-accueil-code",
            suite(vec![("pave", 0, "1"), ("pave", 0, "2")]),
        ),
        (
            "03-confirmation",
            suite(vec![("accueil", 0, ""), ("badge", 0, "04:C1:E2:D3")]),
        ),
        (
            "04-deja-pointe",
            suite(vec![("accueil", 0, ""), ("badge", 0, "04C1E2D3")]),
        ),
        (
            "05-badge-inconnu",
            suite(vec![("accueil", 0, ""), ("badge", 0, "DEADBEEF")]),
        ),
        (
            "06-identification",
            suite(vec![("accueil", 0, ""), ("demande", 0, "heures")]),
        ),
        (
            "07-mes-heures",
            suite(vec![
                ("pave", 0, "1"),
                ("pave", 0, "1"),
                ("pave", 0, "1"),
                ("pave", 0, "1"),
            ]),
        ),
        ("08-signaler", Box::new(a("sg-ouvrir", 0, ""))),
        ("09-signaler-oubli", Box::new(a("sg-categorie", 0, "oubli"))),
        (
            "10-signaler-materiel",
            suite(vec![("sg-ouvrir", 0, ""), ("sg-categorie", 0, "securite")]),
        ),
        (
            "11-clavier",
            suite(vec![
                ("sg-detail", 0, ""),
                ("clavier", 0, "F"),
                ("clavier", 0, "u"),
                ("clavier", 0, "i"),
                ("clavier", 0, "t"),
                ("clavier", 0, "e"),
            ]),
        ),
        (
            "12-merci",
            suite(vec![("clavier", 0, "ok"), ("sg-envoyer", 0, "")]),
        ),
        (
            "13-code-admin",
            suite(vec![
                ("accueil", 0, ""),
                ("admin", 0, ""),
                ("pave", 0, "0"),
                ("pave", 0, "0"),
            ]),
        ),
        (
            "14-admin-menu",
            suite(vec![
                ("pave", 0, "0"),
                ("pave", 0, "0"),
                ("pave", 0, "0"),
                ("pave", 0, "0"),
            ]),
        ),
        ("15-presents", Box::new(a("aller", 0, "presents"))),
        ("16-heures", Box::new(a("aller", 0, "heures"))),
        (
            "17-detail",
            // Journée du premier oubli de la liste (les dates dépendent du jour de lancement).
            Box::new(|app: &mut App, ui: &AppWindow| {
                app.action("aller", 0, "oublis");
                if let Some(o) = ui.global::<Etat>().get_oublis().row_data(0) {
                    app.action("detail-oubli", o.salarie, o.date.as_str());
                }
            }),
        ),
        (
            "18-modifier",
            Box::new(|app: &mut App, ui: &AppWindow| {
                if let Some(p) = ui.global::<Etat>().get_det_pointages().row_data(0) {
                    app.action("pt-modifier", p.id, "");
                    app.action("ed-heure", 1, "m");
                }
                ui.global::<Etat>().set_edition_motif(0);
            }),
        ),
        (
            "19-oublis",
            suite(vec![("ed-annuler", 0, ""), ("aller", 0, "oublis")]),
        ),
        ("20-signalements", Box::new(a("aller", 0, "signalements"))),
        (
            "21-signalement",
            Box::new(|app: &mut App, ui: &AppWindow| {
                let liste = ui.global::<Etat>().get_signalements();
                if let Some(s) = liste
                    .iter()
                    .find(|s| s.categorie.as_str() == "Sécurité / danger")
                {
                    app.action("signalement", s.id, "");
                }
            }),
        ),
        ("22-salaries", Box::new(a("aller", 0, "salaries"))),
        ("23-fiche", Box::new(a("fiche", 1, ""))),
        (
            "24-nouveau-salarie",
            suite(vec![
                ("aller", 0, "salaries"),
                ("fiche", 0, ""),
                ("fi-badge", 1, ""),
            ]),
        ),
        (
            "25-export",
            suite(vec![
                ("fi-badge", 0, ""),
                ("aller", 0, "export"),
                ("exporter", 0, ""),
            ]),
        ),
        ("26-journal", Box::new(a("aller", 0, "journal"))),
        ("27-reglages", Box::new(a("aller", 0, "reglages"))),
    ]
}

pub fn lancer(app: Rc<RefCell<App>>, ui: AppWindow, dossier: PathBuf) {
    std::fs::create_dir_all(&dossier).expect("dossier de captures");
    let etapes = scenario();
    let pas = Rc::new(RefCell::new(0usize));
    let minuterie = slint::Timer::default();
    minuterie.start(
        slint::TimerMode::Repeated,
        Duration::from_millis(400),
        move || {
            let mut i = pas.borrow_mut();
            let (index, capture) = (*i / 2, *i % 2 == 1);
            *i += 1;
            if index >= etapes.len() {
                let _ = slint::quit_event_loop();
                return;
            }
            let (nom, etape) = &etapes[index];
            if !capture {
                etape(&mut app.borrow_mut(), &ui);
                return;
            }
            match ui.window().take_snapshot() {
                Ok(img) => {
                    let chemin =
                        dossier.join(format!("{nom}_{}x{}.rgba", img.width(), img.height()));
                    std::fs::write(&chemin, img.as_bytes()).expect("écriture capture");
                    println!("{}", chemin.display());
                }
                Err(e) => eprintln!("capture {nom} : {e}"),
            }
        },
    );
    std::mem::forget(minuterie);
}

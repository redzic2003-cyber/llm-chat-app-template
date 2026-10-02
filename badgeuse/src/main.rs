//! Badgeuse : pointage des horaires sur tablette tactile 7", en Slint.
//!
//! Options :
//!   --plein-ecran       occupe tout l'écran (mode borne)
//!   --donnees DOSSIER   emplacement de la base (défaut : ~/.local/share/badgeuse)
//!   --demo              remplit une base vide avec des données d'exemple
//!   --captures DOSSIER  (développement) enregistre une capture de chaque écran

mod app;
mod captures;
mod db;
mod demo;
mod export;
mod pointage;

use std::cell::RefCell;
use std::path::PathBuf;
use std::rc::Rc;
use std::time::Duration;

slint::include_modules!();

fn argument(nom: &str) -> Option<String> {
    let args: Vec<String> = std::env::args().collect();
    args.iter()
        .position(|a| a == nom)
        .and_then(|i| args.get(i + 1).cloned())
}

fn option(nom: &str) -> bool {
    std::env::args().any(|a| a == nom)
}

fn dossier_donnees() -> PathBuf {
    if let Some(d) = argument("--donnees").or_else(|| std::env::var("BADGEUSE_DONNEES").ok()) {
        return PathBuf::from(d);
    }
    match std::env::var("HOME") {
        Ok(home) => PathBuf::from(home).join(".local/share/badgeuse"),
        Err(_) => PathBuf::from("donnees"),
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let dossier = dossier_donnees();
    std::fs::create_dir_all(&dossier)?;
    let db = db::Db::ouvrir(&dossier.join("badgeuse.db"))?;
    if option("--demo") {
        demo::remplir(&db)?;
    }

    let ui = AppWindow::new()?;
    if option("--plein-ecran") {
        ui.window().set_fullscreen(true);
    }

    let app = Rc::new(RefCell::new(app::App::new(db, ui.clone_strong(), dossier)));
    {
        let app = app.clone();
        ui.global::<Etat>()
            .on_action(move |nom, n, texte| app.borrow_mut().action(&nom, n, &texte));
    }

    let horloge = slint::Timer::default();
    {
        let app = app.clone();
        horloge.start(
            slint::TimerMode::Repeated,
            Duration::from_secs(1),
            move || app.borrow_mut().tic(),
        );
    }

    if let Some(d) = argument("--captures") {
        captures::lancer(app.clone(), ui.clone_strong(), PathBuf::from(d));
    }

    ui.run()?;
    Ok(())
}

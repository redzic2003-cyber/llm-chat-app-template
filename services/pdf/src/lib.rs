//! Service PDF du Training Manager.
//!
//! Il reçoit un JSON déjà filtré et autorisé par l'API (aucun accès à la base,
//! aucune authentification, aucun QR) et produit uniquement des documents :
//! mise en page, graphiques SVG vectoriels, tableaux paginés, métadonnées.

pub mod charts;
pub mod fonts;
pub mod format;
pub mod layout;
pub mod model;
pub mod render;
pub mod server;

pub use model::ReportPayload;
pub use render::render_pdf;

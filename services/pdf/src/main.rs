//! `training-pdf` — service de rendu PDF.
//!
//! Variables d'environnement :
//!   PDF_BIND   adresse d'écoute (défaut 127.0.0.1:8090 — ne jamais exposer publiquement)
//!   RUST_LOG   niveau de log (défaut info)

use std::net::SocketAddr;

use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .json()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .with_current_span(false)
        .init();

    let addr: SocketAddr = std::env::var("PDF_BIND")
        .unwrap_or_else(|_| "127.0.0.1:8090".into())
        .parse()?;
    // Préchargement des polices pour que la première requête ne paie pas l'initialisation.
    let _ = training_pdf::fonts::Fonts::get();

    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(%addr, version = env!("CARGO_PKG_VERSION"), "pdf.listening");
    axum::serve(listener, training_pdf::server::router())
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    tracing::info!("pdf.stopped");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        let _ = tokio::signal::ctrl_c().await;
    };
    #[cfg(unix)]
    let terminate = async {
        if let Ok(mut s) = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
            s.recv().await;
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}

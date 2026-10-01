//! API HTTP interne du service PDF (écoute uniquement sur 127.0.0.1 ou le réseau Docker interne).
//!
//!   GET  /health  → {"status":"ok"}
//!   POST /render  → JSON du rapport → application/pdf

use std::time::Instant;

use axum::body::Bytes;
use axum::extract::DefaultBodyLimit;
use axum::http::{HeaderValue, StatusCode, header};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde_json::json;

use crate::model::ReportPayload;
use crate::render::render_pdf;

pub const MAX_BODY_BYTES: usize = 8 * 1024 * 1024;

pub fn router() -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/render", post(render))
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
}

async fn health() -> Json<serde_json::Value> {
    Json(json!({ "status": "ok", "version": env!("CARGO_PKG_VERSION") }))
}

fn error(status: StatusCode, code: &str, message: String) -> Response {
    (status, Json(json!({ "error": { "code": code, "message": message } }))).into_response()
}

async fn render(body: Bytes) -> Response {
    let started = Instant::now();
    let payload: ReportPayload = match serde_json::from_slice(&body) {
        Ok(p) => p,
        Err(e) => {
            tracing::warn!(error = %e, "render.invalid_payload");
            return error(
                StatusCode::BAD_REQUEST,
                "VALIDATION_ERROR",
                format!("JSON de rapport invalide : {e}"),
            );
        }
    };
    let report_type = format!("{:?}", payload.report_type).to_lowercase();
    // Le rendu est CPU-bound : il ne doit pas bloquer la boucle asynchrone.
    let result = tokio::task::spawn_blocking(move || render_pdf(&payload)).await;
    match result {
        Ok(Ok(pdf)) => {
            tracing::info!(
                report_type,
                bytes = pdf.len(),
                ms = started.elapsed().as_millis() as u64,
                "render.ok"
            );
            let mut response = pdf.into_response();
            let headers = response.headers_mut();
            headers.insert(header::CONTENT_TYPE, HeaderValue::from_static("application/pdf"));
            headers.insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
            response
        }
        Ok(Err(e)) => {
            tracing::error!(report_type, error = %e, "render.failed");
            error(StatusCode::UNPROCESSABLE_ENTITY, "RENDER_FAILED", e.to_string())
        }
        Err(e) => {
            tracing::error!(report_type, error = %e, "render.panicked");
            error(
                StatusCode::INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "Erreur interne du moteur PDF.".into(),
            )
        }
    }
}

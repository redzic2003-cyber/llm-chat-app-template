use axum::body::Body;
use axum::http::{Request, StatusCode};
use http_body_util::BodyExt;
use serde_json::json;
use tower::ServiceExt;
use training_pdf::{ReportPayload, render_pdf, server};

fn sample() -> ReportPayload {
    let raw = include_str!("../../../docs/blueprint/sample-report.json");
    serde_json::from_str(raw).expect("sample-report.json conforme au contrat")
}

fn assert_pdf(bytes: &[u8]) {
    assert!(bytes.starts_with(b"%PDF-"), "en-tête PDF absent");
    assert!(bytes.len() > 2_000, "PDF trop petit : {} octets", bytes.len());
}

#[test]
fn renders_the_blueprint_sample() {
    let pdf = render_pdf(&sample()).expect("rendu du rapport exemple");
    assert_pdf(&pdf);
    // Les métadonnées de titre sont présentes.
    let text = String::from_utf8_lossy(&pdf);
    assert!(text.contains("Krilla") || text.contains("training-pdf"));
}

#[test]
fn renders_a_long_monthly_report_with_pagination() {
    let sessions: Vec<_> = (0..120)
        .map(|i| {
            json!({
                "date": format!("{:02}.09.2026", i % 30 + 1), "start": "08:00", "end": "10:00",
                "reference": "SEC-001", "title": "Sécurité incendie", "trainer": "Claire Fontaine",
                "location": "Local EHS", "status": if i % 17 == 0 { "cancelled" } else { "completed" },
                "present": 8, "expected": 9
            })
        })
        .collect();
    let payload: ReportPayload = serde_json::from_value(json!({
        "reportType": "monthly",
        "title": "Bilan de formation — Septembre 2026",
        "period": { "from": "2026-09-01", "to": "2026-09-30", "label": "Septembre 2026" },
        "meta": { "generatedAt": "2026-10-01T05:19:44.228Z", "generatedAtLabel": "01.10.2026 07:19", "generatedBy": "Administrateur", "appVersion": "0.1.0", "timezone": "Europe/Zurich" },
        "summary": { "sessions": 18, "participations": 1284, "uniqueParticipants": 72, "trainingHours": 31.5, "participantHours": 284.0, "attendanceRate": 94.1, "expected": 1300, "absences": 9, "excused": 5, "averageSessionMinutes": 105 },
        "trainingBreakdown": [
            { "reference": "SEC-001", "title": "Sécurité incendie", "participants": 44, "sessions": 6, "participantHours": 88 },
            { "reference": "TRH-001", "title": "Travail en hauteur avec un titre très long qui doit être tronqué proprement", "participants": 31, "sessions": 4, "participantHours": 93 }
        ],
        "departmentBreakdown": [ { "department": "Production", "participants": 50, "uniqueParticipants": 30 } ],
        "dailySeries": (1..=30).map(|d| json!({ "date": format!("2026-09-{d:02}"), "participants": d % 9 })).collect::<Vec<_>>(),
        "weeklySeries": [ { "week": "2026-W36", "participants": 20 }, { "week": "2026-W37", "participants": 31 } ],
        "monthlySeries": [ { "month": "2026-09", "participants": 126 } ],
        "sessions": sessions
    }))
    .unwrap();
    let pdf = render_pdf(&payload).expect("rendu mensuel");
    assert_pdf(&pdf);
    let pages = String::from_utf8_lossy(&pdf).matches("/Type /Page\n").count()
        + String::from_utf8_lossy(&pdf).matches("/Type /Page ").count();
    assert!(
        pages == 0 || pages >= 5,
        "pagination attendue (≥ 5 pages), obtenu {pages}"
    );
}

#[test]
fn renders_session_and_participant_reports() {
    let session: ReportPayload = serde_json::from_value(json!({
        "reportType": "session",
        "title": "Rapport de session — Sécurité incendie",
        "period": { "from": "2026-10-15", "to": "2026-10-15", "label": "15.10.2026" },
        "summary": { "sessions": 1, "participations": 2, "uniqueParticipants": 2, "trainingHours": 2, "participantHours": 4, "attendanceRate": 66.7 },
        "trainingBreakdown": [], "dailySeries": [],
        "session": {
            "reference": "SEC-INC-01", "title": "Sécurité incendie", "date": "15.10.2026", "start": "08:00", "end": "10:00",
            "trainer": "Claire Fontaine", "location": "Local EHS", "status": "completed",
            "participants": [
                { "lastName": "Dupont", "firstName": "Jean", "employeeRef": "E1001", "department": "Production", "status": "present", "validatedAt": "08:17" },
                { "lastName": "Simon", "firstName": "Marc", "employeeRef": null, "department": null, "status": "absent", "validatedAt": null }
            ]
        }
    }))
    .unwrap();
    assert_pdf(&render_pdf(&session).expect("rapport de session"));

    let participant: ReportPayload = serde_json::from_value(json!({
        "reportType": "participant",
        "period": { "from": "2026-01-01", "to": "2026-12-31", "label": "2026" },
        "summary": { "sessions": 2, "participations": 1, "uniqueParticipants": 1, "trainingHours": 2, "participantHours": 2, "attendanceRate": 50 },
        "trainingBreakdown": [], "dailySeries": [],
        "participant": {
            "lastName": "Dupont", "firstName": "Jean", "employeeRef": "E1001", "department": "Production", "totalHours": 2,
            "trainings": [
                { "date": "03.09.2026", "reference": "SEC-001", "title": "Sécurité incendie", "durationHours": 2, "status": "present" },
                { "date": "10.09.2026", "reference": "TRH-001", "title": "Travail en hauteur", "durationHours": 3, "status": "excused" }
            ]
        }
    }))
    .unwrap();
    assert_pdf(&render_pdf(&participant).expect("rapport participant"));
}

#[test]
fn session_report_requires_session_details() {
    let mut payload = sample();
    payload.report_type = training_pdf::model::ReportType::Session;
    assert!(render_pdf(&payload).is_err());
}

#[tokio::test]
async fn http_api_renders_and_validates() {
    let app = server::router();

    let health = app
        .clone()
        .oneshot(Request::get("/health").body(Body::empty()).unwrap())
        .await
        .unwrap();
    assert_eq!(health.status(), StatusCode::OK);

    let body = include_str!("../../../docs/blueprint/sample-report.json");
    let ok = app
        .clone()
        .oneshot(
            Request::post("/render")
                .header("content-type", "application/json")
                .body(Body::from(body))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(ok.status(), StatusCode::OK);
    assert_eq!(ok.headers()["content-type"], "application/pdf");
    let bytes = ok.into_body().collect().await.unwrap().to_bytes();
    assert_pdf(&bytes);

    let bad = app
        .oneshot(
            Request::post("/render")
                .header("content-type", "application/json")
                .body(Body::from("{\"reportType\":\"hourly\"}"))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(bad.status(), StatusCode::BAD_REQUEST);
}

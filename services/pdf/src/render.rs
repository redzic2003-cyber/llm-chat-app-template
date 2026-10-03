//! Modèles de rapports (docs/blueprint/09-pdf-krilla.md) :
//! - période (hebdomadaire, mensuel, annuel, libre) : KPI, répartition par
//!   formation, séries temporelles, liste détaillée des sessions ;
//! - session : en-tête + liste des participants avec heure de validation ;
//! - participant : historique individuel et total d'heures.

use krilla::metadata::{DateTime, Metadata};

use crate::charts;
use crate::fonts::Weight;
use crate::format;
use crate::layout::{Builder, CONTENT_W, Cell, Chrome, Column, MARGIN_X, palette, render};
use crate::model::{ReportPayload, ReportType};

const APP_NAME: &str = "Livoti Formations";

/// Point d'entrée : JSON validé → octets PDF.
pub fn render_pdf(payload: &ReportPayload) -> anyhow::Result<Vec<u8>> {
    let mut b = Builder::new();
    title_block(&mut b, payload);
    match payload.report_type {
        ReportType::Session => session_report(&mut b, payload)?,
        ReportType::Participant => participant_report(&mut b, payload),
        _ => period_report(&mut b, payload)?,
    }
    let chrome = Chrome {
        running_title: document_title(payload),
        footer: footer_text(payload),
    };
    render(b.finish(), &chrome, metadata(payload))
}

pub fn document_title(payload: &ReportPayload) -> String {
    payload.title.clone().unwrap_or_else(|| match payload.report_type {
        ReportType::Session => "Rapport de session".to_string(),
        ReportType::Participant => "Historique de formation".to_string(),
        _ => format!("Bilan de formation — {}", payload.period.label),
    })
}

fn footer_text(payload: &ReportPayload) -> String {
    let meta = payload.meta.clone().unwrap_or_default();
    let mut parts = vec![
        meta.organization
            .clone()
            .filter(|o| !o.is_empty())
            .unwrap_or_else(|| APP_NAME.to_string()),
    ];
    if let Some(v) = meta.app_version {
        parts.push(format!("v{v}"));
    }
    if let Some(at) = meta.generated_at_label.or(meta.generated_at.map(|g| iso_label(&g))) {
        parts.push(format!("généré le {at}"));
    }
    if let Some(by) = meta.generated_by {
        parts.push(format!("par {by}"));
    }
    parts.join(" · ")
}

/// `2026-10-01T05:19:44.228Z` → `01.10.2026 05:19 UTC` (repli si l'API n'a pas fourni de libellé local).
fn iso_label(iso: &str) -> String {
    match parse_iso(iso) {
        Some((y, mo, d, h, mi, _)) => format!("{d:02}.{mo:02}.{y} {h:02}:{mi:02} UTC"),
        None => iso.to_string(),
    }
}

fn parse_iso(iso: &str) -> Option<(u16, u8, u8, u8, u8, u8)> {
    let (date, time) = iso.split_once('T')?;
    let mut d = date.split('-').map(|p| p.parse::<u16>().ok());
    let (y, mo, da) = (d.next()??, d.next()??, d.next()??);
    let t: Vec<u8> = time
        .trim_end_matches('Z')
        .split(['.', '+'])
        .next()?
        .split(':')
        .filter_map(|p| p.parse().ok())
        .collect();
    Some((
        y,
        mo as u8,
        da as u8,
        *t.first()?,
        *t.get(1)?,
        t.get(2).copied().unwrap_or(0),
    ))
}

fn metadata(payload: &ReportPayload) -> Metadata {
    let meta = payload.meta.clone().unwrap_or_default();
    let version = meta
        .app_version
        .clone()
        .unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_string());
    let mut m = Metadata::new()
        .title(document_title(payload))
        .description(format!(
            "Période : {} ({} – {})",
            payload.period.label,
            format::date_key(&payload.period.from),
            format::date_key(&payload.period.to)
        ))
        .keywords(vec![
            format!("report-type:{:?}", payload.report_type).to_lowercase(),
            format!("period:{}/{}", payload.period.from, payload.period.to),
        ])
        .language("fr-CH".to_string())
        .creator(format!("{APP_NAME} {version}"))
        .producer(format!("training-pdf {} (Krilla)", env!("CARGO_PKG_VERSION")));
    if let Some(by) = meta.generated_by {
        m = m.authors(vec![by]);
    }
    if let Some((y, mo, d, h, mi, s)) = meta.generated_at.as_deref().and_then(parse_iso) {
        m = m.creation_date(
            DateTime::new(y)
                .month(mo)
                .day(d)
                .hour(h)
                .minute(mi)
                .second(s)
                .utc_offset_hour(0)
                .utc_offset_minute(0),
        );
    }
    m
}

fn title_block(b: &mut Builder, payload: &ReportPayload) {
    let meta = payload.meta.clone().unwrap_or_default();
    let org = meta
        .organization
        .filter(|o| !o.is_empty())
        .unwrap_or_else(|| APP_NAME.to_string());
    b.rect(MARGIN_X, b.y, 28.0, 3.0, palette::ACCENT);
    b.y += 18.0;
    b.text(MARGIN_X, b.y, 9.0, Weight::Bold, palette::MUTED, org.to_uppercase());
    b.y += 26.0;
    let title = document_title(payload);
    for line in crate::fonts::wrap(&title, 20.0, Weight::Bold, CONTENT_W) {
        b.text(MARGIN_X, b.y, 20.0, Weight::Bold, palette::TEXT, line);
        b.y += 25.0;
    }
    let period = if payload.period.from == payload.period.to {
        format::date_key(&payload.period.from)
    } else {
        format!(
            "{} – {}",
            format::date_key(&payload.period.from),
            format::date_key(&payload.period.to)
        )
    };
    b.text(
        MARGIN_X,
        b.y,
        10.5,
        Weight::Regular,
        palette::MUTED,
        format!("Période : {period}"),
    );
    b.y += 22.0;
}

// ---------------------------------------------------------------------------
// Rapport de période
// ---------------------------------------------------------------------------

fn period_report(b: &mut Builder, p: &ReportPayload) -> anyhow::Result<()> {
    let s = &p.summary;

    // Page 1 — indicateurs
    b.heading("Indicateurs clés");
    b.kpis(
        &[
            (
                "Sessions",
                format::int(s.sessions),
                format!("{} de formation", format::hours(s.training_hours)),
            ),
            (
                "Participations",
                format::int(s.participations),
                "présences validées".to_string(),
            ),
            (
                "Participants uniques",
                format::int(s.unique_participants),
                "personnes formées".to_string(),
            ),
            (
                "Heures de formation",
                format::decimal(s.training_hours),
                "somme des durées".to_string(),
            ),
            (
                "Heures-participants",
                format::decimal(s.participant_hours),
                "durée × présents".to_string(),
            ),
            (
                "Taux de présence",
                format::percent(s.attendance_rate),
                s.expected
                    .map(|e| {
                        format!(
                            "{} présents / {} attendus",
                            format::int(s.participations),
                            format::int(e)
                        )
                    })
                    .unwrap_or_default(),
            ),
        ],
        3,
    );
    let mut secondary = Vec::new();
    if let Some(a) = s.absences {
        secondary.push(("Absences", format::int(a), "non justifiées".to_string()));
    }
    if let Some(e) = s.excused {
        secondary.push(("Excusés", format::int(e), "absences justifiées".to_string()));
    }
    if let Some(m) = s.average_session_minutes {
        secondary.push((
            "Durée moyenne",
            format!("{} min", format::int(m.round() as u64)),
            "par session".to_string(),
        ));
    }
    if !secondary.is_empty() {
        b.kpis(&secondary, 3);
    }
    b.gap(8.0);
    b.paragraph(
        "Participations : présences validées, une personne présente à trois sessions compte trois participations. \
         Heures-participants : durée de la session × nombre de présents. Taux de présence : présents / participants \
         attendus (hors absences excusées), sur les sessions déjà commencées. Les sessions annulées et les brouillons \
         ne sont pas comptés.",
        8.5,
        palette::MUTED,
    );

    // Page 2 — répartition
    b.new_page();
    b.heading("Répartition par formation");
    if p.training_breakdown.is_empty() {
        b.paragraph("Aucune participation sur la période.", 10.0, palette::MUTED);
    } else {
        let rows: Vec<(String, u64)> = p
            .training_breakdown
            .iter()
            .map(|r| (r.title.clone(), r.participants))
            .collect();
        let (svg, h) = charts::horizontal_bars(&rows, CONTENT_W);
        b.ensure(h + 10.0);
        b.svg(MARGIN_X, b.y, CONTENT_W, h, charts::parse(&svg)?);
        b.y += h + 12.0;
        b.table(
            &[
                Column::left("Référence", 1.2),
                Column::left("Formation", 2.6),
                Column::right("Sessions", 0.9),
                Column::right("Participations", 1.2),
                Column::right("Heures-part.", 1.1),
            ],
            p.training_breakdown
                .iter()
                .map(|r| {
                    vec![
                        Cell::colored(r.reference.clone(), palette::MUTED),
                        Cell::bold(r.title.clone()),
                        r.sessions.map(format::int).unwrap_or_else(|| "—".into()).into(),
                        format::int(r.participants).into(),
                        r.participant_hours
                            .map(format::decimal)
                            .unwrap_or_else(|| "—".into())
                            .into(),
                    ]
                })
                .collect(),
        );
    }
    if !p.department_breakdown.is_empty() {
        b.heading("Répartition par département");
        let rows: Vec<(String, u64)> = p
            .department_breakdown
            .iter()
            .map(|r| (r.department.clone(), r.participants))
            .collect();
        let (svg, h) = charts::horizontal_bars(&rows, CONTENT_W);
        b.ensure(h + 10.0);
        b.svg(MARGIN_X, b.y, CONTENT_W, h, charts::parse(&svg)?);
        b.y += h + 12.0;
        b.table(
            &[
                Column::left("Département", 3.0),
                Column::right("Participations", 1.2),
                Column::right("Personnes", 1.2),
            ],
            p.department_breakdown
                .iter()
                .map(|r| {
                    vec![
                        Cell::bold(r.department.clone()),
                        format::int(r.participants).into(),
                        r.unique_participants
                            .map(format::int)
                            .unwrap_or_else(|| "—".into())
                            .into(),
                    ]
                })
                .collect(),
        );
    }

    // Page 3 — séries temporelles
    b.new_page();
    let chart_h = 190.0;
    let mut drew = false;
    if !p.daily_series.is_empty() && p.daily_series.len() <= 62 {
        b.heading("Participants par jour");
        let points: Vec<(String, u64)> = p
            .daily_series
            .iter()
            .map(|d| (format::day_short(&d.date), d.participants))
            .collect();
        b.ensure(chart_h);
        b.svg(
            MARGIN_X,
            b.y,
            CONTENT_W,
            chart_h,
            charts::parse(&charts::columns(&points, CONTENT_W, chart_h))?,
        );
        b.y += chart_h + 6.0;
        drew = true;
    }
    if p.weekly_series.len() >= 2 && p.weekly_series.len() <= 60 {
        b.heading("Participants par semaine");
        let points: Vec<(String, u64)> = p
            .weekly_series
            .iter()
            .map(|w| (format::week_short(&w.week), w.participants))
            .collect();
        b.ensure(chart_h);
        b.svg(
            MARGIN_X,
            b.y,
            CONTENT_W,
            chart_h,
            charts::parse(&charts::columns(&points, CONTENT_W, chart_h))?,
        );
        b.y += chart_h + 6.0;
        drew = true;
    }
    if p.monthly_series.len() >= 2 {
        b.heading("Participants par mois");
        let points: Vec<(String, u64)> = p
            .monthly_series
            .iter()
            .map(|m| (format::month_short(&m.month), m.participants))
            .collect();
        b.ensure(chart_h);
        b.svg(
            MARGIN_X,
            b.y,
            CONTENT_W,
            chart_h,
            charts::parse(&charts::columns(&points, CONTENT_W, chart_h))?,
        );
        b.y += chart_h + 6.0;
        drew = true;
    }
    if !drew {
        b.heading("Évolution");
        b.paragraph(
            "Aucune série temporelle disponible pour cette période.",
            10.0,
            palette::MUTED,
        );
    }

    // Page 4+ — détail des sessions
    if !p.sessions.is_empty() {
        b.new_page();
        b.heading(&format!("Liste détaillée des sessions ({})", p.sessions.len()));
        b.table(
            &[
                Column::left("Date", 1.0),
                Column::left("Horaire", 1.25),
                Column::left("Formation", 2.2),
                Column::left("Formateur", 1.35),
                Column::left("Lieu", 1.2),
                Column::right("Prés./att.", 0.95),
                Column::left("Statut", 0.95),
            ],
            p.sessions
                .iter()
                .map(|s| {
                    let cancelled = s.status == "cancelled";
                    let color = if cancelled { palette::SUBTLE } else { palette::TEXT };
                    vec![
                        Cell::colored(s.date.clone(), color),
                        Cell::colored(format!("{}–{}", s.start, s.end), color),
                        Cell {
                            text: s.title.clone(),
                            weight: if cancelled { Weight::Regular } else { Weight::Bold },
                            color,
                        },
                        Cell::colored(s.trainer.clone(), color),
                        Cell::colored(s.location.clone().unwrap_or_else(|| "—".into()), color),
                        Cell::colored(
                            if cancelled {
                                "—".into()
                            } else {
                                format!("{} / {}", s.present, s.expected)
                            },
                            color,
                        ),
                        Cell::colored(format::session_status(&s.status), status_color(&s.status)),
                    ]
                })
                .collect(),
        );
    }
    Ok(())
}

fn status_color(status: &str) -> crate::layout::Rgb {
    match status {
        "present" | "completed" => palette::SUCCESS,
        "absent" => palette::DANGER,
        "excused" | "in_progress" => palette::WARNING,
        "cancelled" => palette::SUBTLE,
        _ => palette::TEXT,
    }
}

// ---------------------------------------------------------------------------
// Rapport de session
// ---------------------------------------------------------------------------

fn session_report(b: &mut Builder, p: &ReportPayload) -> anyhow::Result<()> {
    let session = p
        .session
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("champ `session` manquant pour un rapport de session"))?;
    b.heading("Session");
    b.facts(
        &[
            ("Formation", session.title.clone()),
            ("Référence", session.reference.clone()),
            ("Statut", format::session_status(&session.status).to_string()),
            ("Date", session.date.clone()),
            ("Horaire", format!("{}–{}", session.start, session.end)),
            ("Lieu", session.location.clone().unwrap_or_else(|| "—".into())),
            ("Formateur", session.trainer.clone()),
        ],
        3,
    );
    let present = session.participants.iter().filter(|x| x.status == "present").count() as u64;
    let excused = session.participants.iter().filter(|x| x.status == "excused").count() as u64;
    let expected = session.participants.len() as u64 - excused;
    b.kpis(
        &[
            (
                "Présents",
                format!("{} / {}", format::int(present), format::int(expected)),
                "hors excusés".to_string(),
            ),
            (
                "Taux de présence",
                format::percent(p.summary.attendance_rate),
                String::new(),
            ),
            (
                "Heures-participants",
                format::decimal(p.summary.participant_hours),
                "durée × présents".to_string(),
            ),
        ],
        3,
    );
    b.heading(&format!("Participants ({})", session.participants.len()));
    if session.participants.is_empty() {
        b.paragraph("Aucun participant inscrit.", 10.0, palette::MUTED);
    } else {
        b.table(
            &[
                Column::left("Nom", 1.5),
                Column::left("Prénom", 1.3),
                Column::left("Matricule", 1.0),
                Column::left("Département", 1.4),
                Column::left("Statut", 1.0),
                Column::right("Validé à", 0.9),
            ],
            session
                .participants
                .iter()
                .map(|x| {
                    vec![
                        Cell::bold(x.last_name.clone()),
                        x.first_name.clone().into(),
                        Cell::colored(x.employee_ref.clone().unwrap_or_default(), palette::MUTED),
                        x.department.clone().unwrap_or_else(|| "—".into()).into(),
                        Cell::colored(format::enrollment_status(&x.status), status_color(&x.status)),
                        x.validated_at.clone().unwrap_or_else(|| "—".into()).into(),
                    ]
                })
                .collect(),
        );
    }
    // Zone de signature
    b.ensure(70.0);
    b.gap(24.0);
    b.text(
        MARGIN_X,
        b.y,
        9.0,
        Weight::Regular,
        palette::MUTED,
        "Signature du formateur",
    );
    b.text(
        MARGIN_X + CONTENT_W / 2.0,
        b.y,
        9.0,
        Weight::Regular,
        palette::MUTED,
        "Date",
    );
    b.y += 34.0;
    b.hline(MARGIN_X, MARGIN_X + CONTENT_W / 2.0 - 20.0, b.y, 0.75, palette::BORDER);
    b.hline(
        MARGIN_X + CONTENT_W / 2.0,
        MARGIN_X + CONTENT_W,
        b.y,
        0.75,
        palette::BORDER,
    );
    Ok(())
}

// ---------------------------------------------------------------------------
// Rapport participant
// ---------------------------------------------------------------------------

fn participant_report(b: &mut Builder, p: &ReportPayload) {
    let Some(person) = p.participant.as_ref() else {
        b.paragraph("Aucune donnée participant fournie.", 10.0, palette::MUTED);
        return;
    };
    b.heading("Participant");
    b.facts(
        &[
            ("Nom", person.last_name.to_uppercase()),
            ("Prénom", person.first_name.clone()),
            (
                "Référence interne",
                person.employee_ref.clone().unwrap_or_else(|| "—".into()),
            ),
            ("Département", person.department.clone().unwrap_or_else(|| "—".into())),
        ],
        4,
    );
    let validated = person.trainings.iter().filter(|t| t.status == "present").count() as u64;
    b.kpis(
        &[
            (
                "Formations validées",
                format::int(validated),
                format!("sur {} inscriptions", person.trainings.len()),
            ),
            (
                "Total heures",
                format::hours(person.total_hours),
                "présences validées".to_string(),
            ),
            (
                "Taux de présence",
                format::percent(p.summary.attendance_rate),
                String::new(),
            ),
        ],
        3,
    );
    b.heading("Historique des formations");
    if person.trainings.is_empty() {
        b.paragraph("Aucune formation sur la période.", 10.0, palette::MUTED);
        return;
    }
    b.table(
        &[
            Column::left("Date", 1.0),
            Column::left("Référence", 1.2),
            Column::left("Formation", 2.8),
            Column::right("Durée", 0.8),
            Column::left("Statut", 1.0),
        ],
        person
            .trainings
            .iter()
            .map(|t| {
                vec![
                    t.date.clone().into(),
                    Cell::colored(t.reference.clone(), palette::MUTED),
                    Cell::bold(t.title.clone()),
                    format::hours(t.duration_hours).into(),
                    Cell::colored(format::enrollment_status(&t.status), status_color(&t.status)),
                ]
            })
            .collect(),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_iso_timestamps() {
        assert_eq!(parse_iso("2026-10-01T05:19:44.228Z"), Some((2026, 10, 1, 5, 19, 44)));
        assert_eq!(parse_iso("2026-10-01T05:19Z"), Some((2026, 10, 1, 5, 19, 0)));
        assert_eq!(parse_iso("pas une date"), None);
        assert_eq!(iso_label("2026-10-01T05:19:44.228Z"), "01.10.2026 05:19 UTC");
    }
}

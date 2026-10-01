//! Graphiques générés en SVG puis insérés vectoriellement dans le PDF
//! (jamais de capture du navigateur). Règles : une seule série → une seule
//! couleur, barres fines à extrémité arrondie (4 px) posées sur la ligne de base,
//! grille en filets pleins discrets, étiquettes en couleur de texte, valeurs
//! affichées avec parcimonie.

use std::fmt::Write as _;

use crate::fonts::{FAMILY, Fonts, Weight, text_width, truncate};
use crate::format;

const ACCENT: &str = "#1d4ed8";
const TEXT: &str = "#18212d";
const MUTED: &str = "#5d6877";
const GRID: &str = "#e6e8ec";
const AXIS: &str = "#cdd2da";

fn esc(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

/// Rectangle dont seule l'extrémité « donnée » est arrondie (rayon 4, réduit si la barre est courte).
fn bar_path(x: f32, y: f32, w: f32, h: f32, horizontal: bool) -> String {
    let r = 4.0_f32
        .min(if horizontal { w } else { h })
        .min(if horizontal { h / 2.0 } else { w / 2.0 });
    if r <= 0.5 {
        return format!("M{x:.2},{y:.2}h{w:.2}v{h:.2}h{:.2}z", -w);
    }
    if horizontal {
        // Base à gauche, arrondi à droite.
        format!(
            "M{x:.2},{y:.2}h{:.2}a{r:.2},{r:.2} 0 0 1 {r:.2},{r:.2}v{:.2}a{r:.2},{r:.2} 0 0 1 {:.2},{r:.2}h{:.2}z",
            w - r,
            h - 2.0 * r,
            -r,
            -(w - r)
        )
    } else {
        // Base en bas, arrondi en haut.
        format!(
            "M{x:.2},{:.2}v{:.2}a{r:.2},{r:.2} 0 0 1 {r:.2},{:.2}h{:.2}a{r:.2},{r:.2} 0 0 1 {r:.2},{r:.2}v{:.2}z",
            y + h,
            -(h - r),
            -r,
            w - 2.0 * r,
            h - r
        )
    }
}

/// Graduation « propre » (1, 2, 5 × 10ⁿ) pour au plus ~5 intervalles.
pub fn nice_step(max: f64) -> f64 {
    if max <= 0.0 {
        return 1.0;
    }
    let raw = max / 5.0;
    let magnitude = 10f64.powf(raw.log10().floor());
    let step = [1.0, 2.0, 5.0, 10.0]
        .iter()
        .map(|m| m * magnitude)
        .find(|s| *s >= raw)
        .unwrap_or(10.0 * magnitude);
    step.max(1.0)
}

pub fn parse(svg: &str) -> anyhow::Result<usvg::Tree> {
    let options = usvg::Options {
        font_family: FAMILY.to_string(),
        fontdb: Fonts::get().svg_db.clone(),
        ..Default::default()
    };
    usvg::Tree::from_str(svg, &options).map_err(|e| anyhow::anyhow!("SVG invalide : {e}"))
}

/// Barres horizontales (répartition par formation / département). Renvoie le SVG et sa hauteur.
pub fn horizontal_bars(rows: &[(String, u64)], width: f32) -> (String, f32) {
    let row_h = 22.0;
    let bar_h = 11.0;
    let label_w = (width * 0.36).min(190.0);
    let value_room = 40.0;
    let plot_w = width - label_w - value_room;
    let height = rows.len() as f32 * row_h + 4.0;
    let max = rows.iter().map(|r| r.1).max().unwrap_or(0).max(1) as f32;

    let mut svg = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" font-family="{FAMILY}">"#
    );
    for (i, (label, value)) in rows.iter().enumerate() {
        let cy = 2.0 + i as f32 * row_h + row_h / 2.0;
        let label = truncate(label, 9.0, Weight::Regular, label_w - 10.0);
        let _ = write!(
            svg,
            r#"<text x="{:.2}" y="{:.2}" font-size="9" fill="{TEXT}" text-anchor="end">{}</text>"#,
            label_w - 8.0,
            cy + 3.2,
            esc(&label)
        );
        let w = plot_w * (*value as f32) / max;
        if w > 0.0 {
            let _ = write!(
                svg,
                r#"<path d="{}" fill="{ACCENT}"/>"#,
                bar_path(label_w, cy - bar_h / 2.0, w, bar_h, true)
            );
        }
        let _ = write!(
            svg,
            r#"<text x="{:.2}" y="{:.2}" font-size="9" fill="{MUTED}">{}</text>"#,
            label_w + w + 5.0,
            cy + 3.2,
            format::int(*value)
        );
    }
    svg.push_str("</svg>");
    (svg, height)
}

/// Histogramme en colonnes (participants par jour / semaine / mois).
pub fn columns(points: &[(String, u64)], width: f32, height: f32) -> String {
    let left = 30.0;
    let bottom = 20.0;
    let top = 14.0;
    let plot_w = width - left - 4.0;
    let plot_h = height - bottom - top;
    let max_value = points.iter().map(|p| p.1).max().unwrap_or(0);
    let step = nice_step(max_value as f64);
    let axis_max = ((max_value as f64 / step).ceil() * step).max(step) as f32;

    let mut svg = format!(
        r#"<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" font-family="{FAMILY}">"#
    );

    // Grille horizontale (filets pleins) + graduations.
    let mut tick = 0.0_f32;
    while tick <= axis_max + 0.01 {
        let y = top + plot_h - plot_h * tick / axis_max;
        let color = if tick == 0.0 { AXIS } else { GRID };
        let _ = write!(
            svg,
            r#"<line x1="{left}" y1="{y:.2}" x2="{:.2}" y2="{y:.2}" stroke="{color}" stroke-width="0.6"/>"#,
            left + plot_w
        );
        let _ = write!(
            svg,
            r#"<text x="{:.2}" y="{:.2}" font-size="7.5" fill="{MUTED}" text-anchor="end">{}</text>"#,
            left - 5.0,
            y + 2.6,
            format::int(tick as u64)
        );
        tick += step as f32;
    }

    let n = points.len().max(1) as f32;
    let slot = plot_w / n;
    let bar_w = (slot * 0.62).clamp(1.0, 24.0);
    // Au plus ~14 étiquettes sur l'axe X.
    let label_every = ((points.len() as f32 / 14.0).ceil() as usize).max(1);
    let max_index = points.iter().enumerate().max_by_key(|(_, p)| p.1).map(|(i, _)| i);

    for (i, (label, value)) in points.iter().enumerate() {
        let cx = left + slot * (i as f32 + 0.5);
        let h = plot_h * (*value as f32) / axis_max;
        if h > 0.0 {
            let _ = write!(
                svg,
                r#"<path d="{}" fill="{ACCENT}"/>"#,
                bar_path(cx - bar_w / 2.0, top + plot_h - h, bar_w, h, false)
            );
        }
        if i % label_every == 0 {
            let _ = write!(
                svg,
                r#"<text x="{cx:.2}" y="{:.2}" font-size="7.5" fill="{MUTED}" text-anchor="middle">{}</text>"#,
                top + plot_h + 12.0,
                esc(label)
            );
        }
        // Étiquette sélective : uniquement la valeur maximale.
        if Some(i) == max_index && *value > 0 {
            let _ = write!(
                svg,
                r#"<text x="{cx:.2}" y="{:.2}" font-size="8" font-weight="bold" fill="{TEXT}" text-anchor="middle">{}</text>"#,
                top + plot_h - h - 4.0,
                format::int(*value)
            );
        }
    }
    svg.push_str("</svg>");
    svg
}

/// Vérifie qu'un libellé tient dans la colonne (utilisé par les tests).
pub fn label_fits(label: &str, width: f32) -> bool {
    text_width(label, 9.0, Weight::Regular) <= width
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn nice_steps() {
        assert_eq!(nice_step(0.0), 1.0);
        assert_eq!(nice_step(4.0), 1.0);
        assert_eq!(nice_step(21.0), 5.0);
        assert_eq!(nice_step(130.0), 50.0);
    }

    #[test]
    fn charts_are_valid_svg() {
        let rows = vec![
            ("Feu & <évac.>".to_string(), 44),
            ("Travail en hauteur".to_string(), 31),
        ];
        let (svg, h) = horizontal_bars(&rows, 400.0);
        assert!(h > 40.0);
        assert!(svg.contains("Feu &amp; &lt;évac.&gt;"));
        parse(&svg).expect("SVG barres valide");
        let points: Vec<(String, u64)> = (1..=30).map(|d| (format!("{d:02}.09"), (d % 7) as u64)).collect();
        parse(&columns(&points, 480.0, 180.0)).expect("SVG colonnes valide");
        parse(&columns(&[], 480.0, 180.0)).expect("SVG vide valide");
    }

    #[test]
    fn bar_paths_round_only_the_data_end() {
        assert!(bar_path(0.0, 0.0, 100.0, 10.0, true).contains('a'));
        assert!(!bar_path(0.0, 0.0, 0.3, 10.0, true).contains('a'));
    }
}

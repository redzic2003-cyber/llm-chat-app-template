//! Polices embarquées : le rendu ne dépend jamais des polices installées sur la machine.

use std::sync::{Arc, OnceLock};

use krilla::text::Font;
use skrifa::instance::{LocationRef, Size};
use skrifa::{FontRef, MetadataProvider};

pub const REGULAR_BYTES: &[u8] = include_bytes!("../fonts/LiberationSans-Regular.ttf");
pub const BOLD_BYTES: &[u8] = include_bytes!("../fonts/LiberationSans-Bold.ttf");
pub const FAMILY: &str = "Liberation Sans";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Weight {
    Regular,
    Bold,
}

pub struct Fonts {
    pub regular: Font,
    pub bold: Font,
    /// Base de polices pour le rendu des graphiques SVG (usvg).
    pub svg_db: Arc<usvg::fontdb::Database>,
}

impl Fonts {
    pub fn get() -> &'static Fonts {
        static FONTS: OnceLock<Fonts> = OnceLock::new();
        FONTS.get_or_init(|| {
            let regular = Font::new(REGULAR_BYTES.to_vec().into(), 0).expect("police régulière valide");
            let bold = Font::new(BOLD_BYTES.to_vec().into(), 0).expect("police grasse valide");
            let mut db = usvg::fontdb::Database::new();
            db.load_font_data(REGULAR_BYTES.to_vec());
            db.load_font_data(BOLD_BYTES.to_vec());
            db.set_sans_serif_family(FAMILY);
            Fonts {
                regular,
                bold,
                svg_db: Arc::new(db),
            }
        })
    }

    pub fn font(&self, weight: Weight) -> Font {
        match weight {
            Weight::Regular => self.regular.clone(),
            Weight::Bold => self.bold.clone(),
        }
    }
}

/// Largeur d'un texte en points (somme des avances, sans crénage).
pub fn text_width(text: &str, size: f32, weight: Weight) -> f32 {
    let bytes = match weight {
        Weight::Regular => REGULAR_BYTES,
        Weight::Bold => BOLD_BYTES,
    };
    let Ok(font) = FontRef::new(bytes) else {
        return text.chars().count() as f32 * size * 0.5;
    };
    let charmap = font.charmap();
    let metrics = font.glyph_metrics(Size::new(size), LocationRef::default());
    text.chars()
        .map(|c| {
            charmap
                .map(c)
                .and_then(|g| metrics.advance_width(g))
                .unwrap_or(size * 0.5)
        })
        .sum()
}

/// Tronque un texte avec « … » pour qu'il tienne dans `max_width`.
pub fn truncate(text: &str, size: f32, weight: Weight, max_width: f32) -> String {
    if text_width(text, size, weight) <= max_width {
        return text.to_string();
    }
    let ellipsis_width = text_width("…", size, weight);
    let mut out = String::new();
    let mut width = 0.0;
    for c in text.chars() {
        let w = text_width(&c.to_string(), size, weight);
        if width + w + ellipsis_width > max_width {
            break;
        }
        out.push(c);
        width += w;
    }
    out.trim_end().to_string() + "…"
}

/// Découpe un texte en lignes de largeur maximale `max_width` (coupure aux espaces).
pub fn wrap(text: &str, size: f32, weight: Weight, max_width: f32) -> Vec<String> {
    let mut lines = Vec::new();
    let mut current = String::new();
    for word in text.split_whitespace() {
        let candidate = if current.is_empty() {
            word.to_string()
        } else {
            format!("{current} {word}")
        };
        if text_width(&candidate, size, weight) <= max_width || current.is_empty() {
            current = candidate;
        } else {
            lines.push(std::mem::take(&mut current));
            current = word.to_string();
        }
    }
    if !current.is_empty() {
        lines.push(current);
    }
    lines
}

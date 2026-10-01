//! Mise en page en deux temps : les modèles décrivent des pages sous forme
//! d'opérations (texte, rectangles, filets, SVG), puis `render` les dessine avec
//! Krilla en connaissant le nombre total de pages (pied « Page x / n »).

use krilla::Document;
use krilla::color::rgb;
use krilla::geom::{PathBuilder, Point, Rect, Size, Transform};
use krilla::metadata::Metadata;
use krilla::num::NormalizedF32;
use krilla::page::PageSettings;
use krilla::paint::{Fill, Stroke};
use krilla::surface::Surface;
use krilla::text::TextDirection;
use krilla_svg::{SurfaceExt, SvgSettings};

use crate::fonts::{Fonts, Weight, text_width, truncate, wrap};

/// A4 portrait, en points.
pub const PAGE_W: f32 = 595.28;
pub const PAGE_H: f32 = 841.89;
pub const MARGIN_X: f32 = 48.0;
pub const MARGIN_TOP: f32 = 56.0;
pub const MARGIN_BOTTOM: f32 = 60.0;
pub const CONTENT_W: f32 = PAGE_W - 2.0 * MARGIN_X;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Rgb(pub u8, pub u8, pub u8);

/// Palette sobre, identique à l'interface web : une couleur d'accent, du texte en gris.
pub mod palette {
    use super::Rgb;
    pub const TEXT: Rgb = Rgb(0x18, 0x21, 0x2d);
    pub const MUTED: Rgb = Rgb(0x5d, 0x68, 0x77);
    pub const SUBTLE: Rgb = Rgb(0x8a, 0x94, 0xa3);
    pub const ACCENT: Rgb = Rgb(0x1d, 0x4e, 0xd8);
    pub const BORDER: Rgb = Rgb(0xe2, 0xe5, 0xea);
    pub const SURFACE: Rgb = Rgb(0xf6, 0xf7, 0xf9);
    pub const SUCCESS: Rgb = Rgb(0x15, 0x7f, 0x3c);
    pub const WARNING: Rgb = Rgb(0xa8, 0x59, 0x0b);
    pub const DANGER: Rgb = Rgb(0xb4, 0x23, 0x18);
}

pub enum Op {
    Text {
        x: f32,
        y: f32,
        size: f32,
        weight: Weight,
        color: Rgb,
        text: String,
    },
    Rect {
        x: f32,
        y: f32,
        w: f32,
        h: f32,
        color: Rgb,
    },
    Line {
        x1: f32,
        y1: f32,
        x2: f32,
        y2: f32,
        width: f32,
        color: Rgb,
    },
    Svg {
        x: f32,
        y: f32,
        w: f32,
        h: f32,
        tree: Box<usvg::Tree>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Align {
    Left,
    Right,
}

pub struct Column {
    pub title: &'static str,
    /// Largeur relative (les colonnes se partagent `CONTENT_W`).
    pub flex: f32,
    pub align: Align,
}

impl Column {
    pub const fn left(title: &'static str, flex: f32) -> Self {
        Column {
            title,
            flex,
            align: Align::Left,
        }
    }
    pub const fn right(title: &'static str, flex: f32) -> Self {
        Column {
            title,
            flex,
            align: Align::Right,
        }
    }
}

/// Cellule de tableau : texte + graisse + couleur facultative.
pub struct Cell {
    pub text: String,
    pub weight: Weight,
    pub color: Rgb,
}

impl From<String> for Cell {
    fn from(text: String) -> Self {
        Cell {
            text,
            weight: Weight::Regular,
            color: palette::TEXT,
        }
    }
}

impl From<&str> for Cell {
    fn from(text: &str) -> Self {
        Cell::from(text.to_string())
    }
}

impl Cell {
    pub fn bold(text: impl Into<String>) -> Self {
        Cell {
            text: text.into(),
            weight: Weight::Bold,
            color: palette::TEXT,
        }
    }
    pub fn colored(text: impl Into<String>, color: Rgb) -> Self {
        Cell {
            text: text.into(),
            weight: Weight::Regular,
            color,
        }
    }
}

pub struct Builder {
    pages: Vec<Vec<Op>>,
    /// Ordonnée courante (haut de la prochaine ligne), en points depuis le haut.
    pub y: f32,
}

impl Default for Builder {
    fn default() -> Self {
        Self::new()
    }
}

impl Builder {
    pub fn new() -> Self {
        Builder {
            pages: vec![Vec::new()],
            y: MARGIN_TOP,
        }
    }

    pub fn page_count(&self) -> usize {
        self.pages.len()
    }

    pub fn new_page(&mut self) {
        self.pages.push(Vec::new());
        self.y = MARGIN_TOP;
    }

    /// Bas de la zone utile.
    pub fn bottom(&self) -> f32 {
        PAGE_H - MARGIN_BOTTOM
    }

    pub fn remaining(&self) -> f32 {
        self.bottom() - self.y
    }

    /// Passe à la page suivante si `height` points ne tiennent plus.
    pub fn ensure(&mut self, height: f32) {
        if self.y + height > self.bottom() && self.y > MARGIN_TOP + 1.0 {
            self.new_page();
        }
    }

    fn push(&mut self, op: Op) {
        self.pages.last_mut().expect("au moins une page").push(op);
    }

    /// Texte dont `y` est la ligne de base.
    pub fn text(&mut self, x: f32, y: f32, size: f32, weight: Weight, color: Rgb, text: impl Into<String>) {
        self.push(Op::Text {
            x,
            y,
            size,
            weight,
            color,
            text: text.into(),
        });
    }

    pub fn text_right(&mut self, right: f32, y: f32, size: f32, weight: Weight, color: Rgb, text: impl Into<String>) {
        let text = text.into();
        let w = text_width(&text, size, weight);
        self.text(right - w, y, size, weight, color, text);
    }

    pub fn rect(&mut self, x: f32, y: f32, w: f32, h: f32, color: Rgb) {
        self.push(Op::Rect { x, y, w, h, color });
    }

    pub fn hline(&mut self, x1: f32, x2: f32, y: f32, width: f32, color: Rgb) {
        self.push(Op::Line {
            x1,
            y1: y,
            x2,
            y2: y,
            width,
            color,
        });
    }

    pub fn svg(&mut self, x: f32, y: f32, w: f32, h: f32, tree: usvg::Tree) {
        self.push(Op::Svg {
            x,
            y,
            w,
            h,
            tree: Box::new(tree),
        });
    }

    pub fn gap(&mut self, h: f32) {
        self.y += h;
    }

    /// Titre de section (14 pt, gras) avec filet.
    pub fn heading(&mut self, title: &str) {
        self.ensure(60.0);
        self.y += 18.0;
        self.text(MARGIN_X, self.y, 14.0, Weight::Bold, palette::TEXT, title);
        self.y += 8.0;
        self.hline(MARGIN_X, MARGIN_X + CONTENT_W, self.y, 0.75, palette::BORDER);
        self.y += 14.0;
    }

    /// Paragraphe avec retour à la ligne automatique.
    pub fn paragraph(&mut self, text: &str, size: f32, color: Rgb) {
        let line_h = size * 1.4;
        for line in wrap(text, size, Weight::Regular, CONTENT_W) {
            self.ensure(line_h);
            self.y += size;
            self.text(MARGIN_X, self.y, size, Weight::Regular, color, line);
            self.y += line_h - size;
        }
    }

    /// Paires libellé / valeur sur une grille de `cols` colonnes.
    pub fn facts(&mut self, items: &[(&str, String)], cols: usize) {
        let col_w = CONTENT_W / cols as f32;
        for chunk in items.chunks(cols) {
            self.ensure(36.0);
            for (i, (label, value)) in chunk.iter().enumerate() {
                let x = MARGIN_X + i as f32 * col_w;
                self.text(x, self.y + 9.0, 8.5, Weight::Bold, palette::MUTED, label.to_uppercase());
                let value = truncate(value, 11.0, Weight::Bold, col_w - 12.0);
                self.text(x, self.y + 25.0, 11.0, Weight::Bold, palette::TEXT, value);
            }
            self.y += 38.0;
        }
    }

    /// Tuiles d'indicateurs (libellé, valeur, précision).
    pub fn kpis(&mut self, tiles: &[(&str, String, String)], cols: usize) {
        let gap = 10.0;
        let tile_w = (CONTENT_W - gap * (cols as f32 - 1.0)) / cols as f32;
        let tile_h = 70.0;
        for chunk in tiles.chunks(cols) {
            self.ensure(tile_h + gap);
            for (i, (label, value, hint)) in chunk.iter().enumerate() {
                let x = MARGIN_X + i as f32 * (tile_w + gap);
                self.rect(x, self.y, tile_w, tile_h, palette::SURFACE);
                self.rect(x, self.y, 3.0, tile_h, palette::ACCENT);
                self.text(
                    x + 12.0,
                    self.y + 18.0,
                    8.5,
                    Weight::Bold,
                    palette::MUTED,
                    truncate(label, 8.5, Weight::Bold, tile_w - 20.0),
                );
                self.text(
                    x + 12.0,
                    self.y + 44.0,
                    20.0,
                    Weight::Bold,
                    palette::TEXT,
                    value.clone(),
                );
                if !hint.is_empty() {
                    self.text(
                        x + 12.0,
                        self.y + 60.0,
                        8.0,
                        Weight::Regular,
                        palette::SUBTLE,
                        truncate(hint, 8.0, Weight::Regular, tile_w - 20.0),
                    );
                }
            }
            self.y += tile_h + gap;
        }
    }

    /// Tableau paginé : l'en-tête est répété en haut de chaque nouvelle page.
    pub fn table(&mut self, columns: &[Column], rows: Vec<Vec<Cell>>) {
        let total: f32 = columns.iter().map(|c| c.flex).sum();
        let widths: Vec<f32> = columns.iter().map(|c| CONTENT_W * c.flex / total).collect();
        let row_h = 19.0;
        let header_h = 22.0;
        let size = 8.8;
        let pad = 5.0;

        let draw_header = |b: &mut Builder| {
            b.rect(MARGIN_X, b.y, CONTENT_W, header_h, palette::SURFACE);
            let mut x = MARGIN_X;
            for (col, w) in columns.iter().zip(&widths) {
                let title = col.title.to_uppercase();
                match col.align {
                    Align::Left => b.text(x + pad, b.y + 14.5, 7.5, Weight::Bold, palette::MUTED, title),
                    Align::Right => b.text_right(x + w - pad, b.y + 14.5, 7.5, Weight::Bold, palette::MUTED, title),
                }
                x += w;
            }
            b.y += header_h;
        };

        self.ensure(header_h + row_h * 2.0);
        draw_header(self);
        for row in rows {
            if self.y + row_h > self.bottom() {
                self.new_page();
                draw_header(self);
            }
            let mut x = MARGIN_X;
            for ((cell, col), w) in row.iter().zip(columns).zip(&widths) {
                let text = truncate(&cell.text, size, cell.weight, w - 2.0 * pad);
                match col.align {
                    Align::Left => self.text(x + pad, self.y + 13.0, size, cell.weight, cell.color, text),
                    Align::Right => self.text_right(x + w - pad, self.y + 13.0, size, cell.weight, cell.color, text),
                }
                x += w;
            }
            self.y += row_h;
            self.hline(MARGIN_X, MARGIN_X + CONTENT_W, self.y, 0.5, palette::BORDER);
        }
        self.y += 6.0;
    }

    pub fn finish(self) -> Vec<Vec<Op>> {
        self.pages
    }
}

fn solid(color: Rgb) -> Fill {
    Fill {
        paint: rgb::Color::new(color.0, color.1, color.2).into(),
        opacity: NormalizedF32::ONE,
        rule: Default::default(),
    }
}

fn draw_op(surface: &mut Surface<'_>, fonts: &Fonts, op: &Op) {
    match op {
        Op::Text {
            x,
            y,
            size,
            weight,
            color,
            text,
        } => {
            surface.set_stroke(None);
            surface.set_fill(Some(solid(*color)));
            surface.draw_text(
                Point::from_xy(*x, *y),
                fonts.font(*weight),
                *size,
                text,
                false,
                TextDirection::Auto,
            );
        }
        Op::Rect { x, y, w, h, color } => {
            if let Some(rect) = Rect::from_xywh(*x, *y, *w, *h) {
                let mut pb = PathBuilder::new();
                pb.push_rect(rect);
                if let Some(path) = pb.finish() {
                    surface.set_stroke(None);
                    surface.set_fill(Some(solid(*color)));
                    surface.draw_path(&path);
                }
            }
        }
        Op::Line {
            x1,
            y1,
            x2,
            y2,
            width,
            color,
        } => {
            let mut pb = PathBuilder::new();
            pb.move_to(*x1, *y1);
            pb.line_to(*x2, *y2);
            if let Some(path) = pb.finish() {
                surface.set_fill(None);
                surface.set_stroke(Some(Stroke {
                    paint: rgb::Color::new(color.0, color.1, color.2).into(),
                    width: *width,
                    ..Default::default()
                }));
                surface.draw_path(&path);
                surface.set_stroke(None);
            }
        }
        Op::Svg { x, y, w, h, tree } => {
            if let Some(size) = Size::from_wh(*w, *h) {
                surface.push_transform(&Transform::from_translate(*x, *y));
                surface.draw_svg(tree, size, SvgSettings::default());
                surface.pop();
            }
        }
    }
}

pub struct Chrome {
    /// Rappel discret en tête des pages suivantes (titre du rapport).
    pub running_title: String,
    /// Texte de pied de page à gauche (application, version, date de génération).
    pub footer: String,
}

/// Dessine toutes les pages avec Krilla et renvoie les octets du PDF.
pub fn render(pages: Vec<Vec<Op>>, chrome: &Chrome, metadata: Metadata) -> anyhow::Result<Vec<u8>> {
    let fonts = Fonts::get();
    let mut document = Document::new();
    document.set_metadata(metadata);
    let total = pages.len();
    for (index, ops) in pages.iter().enumerate() {
        let settings =
            PageSettings::from_wh(PAGE_W, PAGE_H).ok_or_else(|| anyhow::anyhow!("format de page invalide"))?;
        let mut page = document.start_page_with(settings);
        let mut surface = page.surface();
        if index > 0 {
            let title = truncate(&chrome.running_title, 8.0, Weight::Regular, CONTENT_W);
            draw_op(
                &mut surface,
                fonts,
                &Op::Text {
                    x: MARGIN_X,
                    y: 32.0,
                    size: 8.0,
                    weight: Weight::Regular,
                    color: palette::SUBTLE,
                    text: title,
                },
            );
            draw_op(
                &mut surface,
                fonts,
                &Op::Line {
                    x1: MARGIN_X,
                    y1: 38.0,
                    x2: MARGIN_X + CONTENT_W,
                    y2: 38.0,
                    width: 0.5,
                    color: palette::BORDER,
                },
            );
        }
        for op in ops {
            draw_op(&mut surface, fonts, op);
        }
        let footer_y = PAGE_H - 30.0;
        draw_op(
            &mut surface,
            fonts,
            &Op::Line {
                x1: MARGIN_X,
                y1: footer_y - 12.0,
                x2: MARGIN_X + CONTENT_W,
                y2: footer_y - 12.0,
                width: 0.5,
                color: palette::BORDER,
            },
        );
        let footer = truncate(&chrome.footer, 7.5, Weight::Regular, CONTENT_W - 80.0);
        draw_op(
            &mut surface,
            fonts,
            &Op::Text {
                x: MARGIN_X,
                y: footer_y,
                size: 7.5,
                weight: Weight::Regular,
                color: palette::SUBTLE,
                text: footer,
            },
        );
        let pager = format!("Page {} / {}", index + 1, total);
        let w = text_width(&pager, 7.5, Weight::Regular);
        draw_op(
            &mut surface,
            fonts,
            &Op::Text {
                x: MARGIN_X + CONTENT_W - w,
                y: footer_y,
                size: 7.5,
                weight: Weight::Regular,
                color: palette::SUBTLE,
                text: pager,
            },
        );
        surface.finish();
        page.finish();
    }
    document
        .finish()
        .map_err(|e| anyhow::anyhow!("échec de sérialisation PDF : {e:?}"))
}

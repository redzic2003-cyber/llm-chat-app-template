//! Formatage français (Suisse) des nombres, dates et statuts.

/// `1 284` (espace fine insécable comme séparateur de milliers).
pub fn int(n: u64) -> String {
    let s = n.to_string();
    let mut out = String::new();
    for (i, c) in s.chars().enumerate() {
        if i > 0 && (s.len() - i).is_multiple_of(3) {
            out.push('\u{202F}');
        }
        out.push(c);
    }
    out
}

/// `31,5` — une décimale au plus, sans zéro inutile.
pub fn decimal(n: f64) -> String {
    let rounded = (n * 10.0).round() / 10.0;
    if rounded.fract().abs() < f64::EPSILON {
        int(rounded.max(0.0) as u64)
    } else {
        let whole = rounded.trunc().max(0.0) as u64;
        let frac = ((rounded.fract().abs()) * 10.0).round() as u64;
        format!("{},{}", int(whole), frac)
    }
}

pub fn hours(n: f64) -> String {
    format!("{} h", decimal(n))
}

pub fn percent(n: Option<f64>) -> String {
    match n {
        Some(v) => format!("{} %", decimal(v)),
        None => "—".to_string(),
    }
}

/// `2026-09-03` → `03.09.2026` (laisse les autres formats intacts).
pub fn date_key(key: &str) -> String {
    let parts: Vec<&str> = key.split('-').collect();
    if parts.len() == 3 && parts[0].len() == 4 {
        format!("{}.{}.{}", parts[2], parts[1], parts[0])
    } else {
        key.to_string()
    }
}

/// `2026-09-03` → `03.09`
pub fn day_short(key: &str) -> String {
    let parts: Vec<&str> = key.split('-').collect();
    if parts.len() == 3 {
        format!("{}.{}", parts[2], parts[1])
    } else {
        key.to_string()
    }
}

/// `2026-W40` → `S40`
pub fn week_short(key: &str) -> String {
    key.split("-W")
        .nth(1)
        .map(|w| format!("S{w}"))
        .unwrap_or_else(|| key.to_string())
}

const MONTHS: [&str; 12] = [
    "janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc.",
];

/// `2026-09` → `sept. 2026`
pub fn month_short(key: &str) -> String {
    let parts: Vec<&str> = key.split('-').collect();
    match parts.get(1).and_then(|m| m.parse::<usize>().ok()) {
        Some(m) if (1..=12).contains(&m) => format!("{} {}", MONTHS[m - 1], parts[0]),
        _ => key.to_string(),
    }
}

pub fn session_status(status: &str) -> &'static str {
    match status {
        "draft" => "Brouillon",
        "planned" => "Planifiée",
        "in_progress" => "En cours",
        "completed" => "Clôturée",
        "cancelled" => "Annulée",
        _ => "—",
    }
}

pub fn enrollment_status(status: &str) -> &'static str {
    match status {
        "invited" => "Invité",
        "expected" => "Non validé",
        "present" => "Présent",
        "absent" => "Absent",
        "excused" => "Excusé",
        _ => "—",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn formats_numbers_the_swiss_french_way() {
        assert_eq!(int(1284), "1\u{202F}284");
        assert_eq!(int(12), "12");
        assert_eq!(decimal(31.5), "31,5");
        assert_eq!(decimal(284.0), "284");
        assert_eq!(decimal(1284.25), "1\u{202F}284,3");
        assert_eq!(percent(Some(94.1)), "94,1 %");
        assert_eq!(percent(None), "—");
    }

    #[test]
    fn formats_dates() {
        assert_eq!(date_key("2026-09-03"), "03.09.2026");
        assert_eq!(day_short("2026-09-03"), "03.09");
        assert_eq!(week_short("2026-W40"), "S40");
        assert_eq!(month_short("2026-09"), "sept. 2026");
    }
}

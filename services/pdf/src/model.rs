//! Contrat d'entrée (`POST /render`), miroir de `ReportPayload` côté TypeScript.
//! Seuls `reportType`, `period`, `summary`, `trainingBreakdown` et `dailySeries`
//! sont obligatoires, comme dans `docs/blueprint/sample-report.json`.

use serde::Deserialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ReportType {
    Weekly,
    Monthly,
    Yearly,
    Custom,
    Session,
    Participant,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportPayload {
    pub report_type: ReportType,
    #[serde(default)]
    pub title: Option<String>,
    pub period: Period,
    #[serde(default)]
    pub meta: Option<Meta>,
    pub summary: Summary,
    #[serde(default)]
    pub training_breakdown: Vec<TrainingRow>,
    #[serde(default)]
    pub daily_series: Vec<DailyPoint>,
    #[serde(default)]
    pub weekly_series: Vec<WeeklyPoint>,
    #[serde(default)]
    pub monthly_series: Vec<MonthlyPoint>,
    #[serde(default)]
    pub department_breakdown: Vec<DepartmentRow>,
    #[serde(default)]
    pub sessions: Vec<SessionLine>,
    #[serde(default)]
    pub session: Option<SessionDetail>,
    #[serde(default)]
    pub participant: Option<ParticipantDetail>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Period {
    pub from: String,
    pub to: String,
    pub label: String,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Meta {
    #[serde(default)]
    pub generated_at: Option<String>,
    #[serde(default)]
    pub generated_at_label: Option<String>,
    #[serde(default)]
    pub generated_by: Option<String>,
    #[serde(default)]
    pub app_version: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub organization: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Summary {
    pub sessions: u64,
    pub participations: u64,
    pub unique_participants: u64,
    pub training_hours: f64,
    pub participant_hours: f64,
    pub attendance_rate: Option<f64>,
    #[serde(default)]
    pub expected: Option<u64>,
    #[serde(default)]
    pub absences: Option<u64>,
    #[serde(default)]
    pub excused: Option<u64>,
    #[serde(default)]
    pub average_session_minutes: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrainingRow {
    pub reference: String,
    pub title: String,
    pub participants: u64,
    #[serde(default)]
    pub sessions: Option<u64>,
    #[serde(default)]
    pub participant_hours: Option<f64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DepartmentRow {
    pub department: String,
    pub participants: u64,
    #[serde(default)]
    pub unique_participants: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct DailyPoint {
    pub date: String,
    pub participants: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct WeeklyPoint {
    pub week: String,
    pub participants: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MonthlyPoint {
    pub month: String,
    pub participants: u64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct SessionLine {
    pub date: String,
    pub start: String,
    pub end: String,
    pub reference: String,
    pub title: String,
    pub trainer: String,
    #[serde(default)]
    pub location: Option<String>,
    pub status: String,
    pub present: u64,
    pub expected: u64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionDetail {
    pub reference: String,
    pub title: String,
    pub date: String,
    pub start: String,
    pub end: String,
    pub trainer: String,
    #[serde(default)]
    pub location: Option<String>,
    pub status: String,
    #[serde(default)]
    pub participants: Vec<SessionParticipant>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionParticipant {
    pub last_name: String,
    pub first_name: String,
    #[serde(default)]
    pub employee_ref: Option<String>,
    #[serde(default)]
    pub department: Option<String>,
    pub status: String,
    #[serde(default)]
    pub validated_at: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParticipantDetail {
    pub last_name: String,
    pub first_name: String,
    #[serde(default)]
    pub employee_ref: Option<String>,
    #[serde(default)]
    pub department: Option<String>,
    pub total_hours: f64,
    #[serde(default)]
    pub trainings: Vec<ParticipantTraining>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParticipantTraining {
    pub date: String,
    pub reference: String,
    pub title: String,
    pub duration_hours: f64,
    pub status: String,
}

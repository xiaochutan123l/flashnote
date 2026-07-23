use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

pub const PLAN_TITLE_LIMIT: usize = 120;
pub const DAILY_NOTE_LIMIT: usize = 5_000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlanItem {
    pub id: String,
    pub title: String,
    pub parent_id: Option<String>,
    pub position: i64,
    pub created_at: i64,
    pub updated_at: i64,
    pub completed_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FocusItem {
    pub id: String,
    pub day: String,
    pub plan_item_id: String,
    pub title: String,
    pub position: i64,
    pub is_current: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub completed_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyNote {
    pub day: String,
    pub content: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyRecord {
    pub day: String,
    pub focus_items: Vec<FocusItem>,
    pub note: Option<DailyNote>,
}

pub fn normalize_title(title: &str) -> Result<String, String> {
    let normalized = title.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        return Err("请输入计划事项".into());
    }
    if normalized.chars().count() > PLAN_TITLE_LIMIT {
        return Err(format!("计划事项不能超过 {PLAN_TITLE_LIMIT} 个字符"));
    }
    Ok(normalized)
}

pub fn normalize_note(content: &str) -> Result<String, String> {
    let normalized = content.trim().replace("\r\n", "\n");
    if normalized.chars().count() > DAILY_NOTE_LIMIT {
        return Err(format!("每日随笔不能超过 {DAILY_NOTE_LIMIT} 个字符"));
    }
    Ok(normalized)
}

pub fn validate_day(day: &str) -> Result<String, String> {
    NaiveDate::parse_from_str(day, "%Y-%m-%d")
        .map(|date| date.format("%Y-%m-%d").to_string())
        .map_err(|_| "日期格式无效".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn planning_inputs_are_normalized_at_the_domain_boundary() {
        assert_eq!(normalize_title("  发布   第一版 ").unwrap(), "发布 第一版");
        assert_eq!(
            normalize_note(" 今天完成了两项。\r\n").unwrap(),
            "今天完成了两项。"
        );
        assert_eq!(validate_day("2026-07-23").unwrap(), "2026-07-23");
        assert!(validate_day("23/07/2026").is_err());
    }
}

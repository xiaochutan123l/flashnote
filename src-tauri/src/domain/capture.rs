use serde::{Deserialize, Serialize};

pub const CAPTURE_CONTENT_LIMIT: usize = 500;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CaptureStatus {
    Inbox,
    Processed,
}

impl CaptureStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Inbox => "inbox",
            Self::Processed => "processed",
        }
    }

    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "inbox" => Some(Self::Inbox),
            "processed" => Some(Self::Processed),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CaptureFilter {
    All,
    Inbox,
    Processed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Capture {
    pub id: String,
    pub content: String,
    pub status: CaptureStatus,
    pub created_at: i64,
    pub updated_at: i64,
    pub processed_at: Option<i64>,
}

/** Domain-owned normalization keeps every caller subject to identical rules. */
pub fn normalize_content(content: &str) -> Result<String, String> {
    let normalized = content.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() {
        return Err("请输入要记录的内容".into());
    }
    if normalized.chars().count() > CAPTURE_CONTENT_LIMIT {
        return Err(format!("内容不能超过 {CAPTURE_CONTENT_LIMIT} 个字符"));
    }
    Ok(normalized)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn content_is_trimmed_and_internal_whitespace_is_collapsed() {
        assert_eq!(
            normalize_content("  一个   新念头 \n ").unwrap(),
            "一个 新念头"
        );
    }

    #[test]
    fn blank_content_is_rejected() {
        assert!(normalize_content(" \n ").is_err());
    }
}

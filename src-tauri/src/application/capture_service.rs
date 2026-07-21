use std::sync::Arc;

use chrono::Utc;
use uuid::Uuid;

use crate::{
    application::ports::CaptureRepository,
    domain::capture::{normalize_content, Capture, CaptureFilter, CaptureStatus},
    error::{AppError, AppResult},
};

/**
 * Coordinates capture use cases without knowing about Tauri, windows, or SQL.
 * This is the stable API that future task and sync modules should call.
 */
#[derive(Clone)]
pub struct CaptureService {
    repository: Arc<dyn CaptureRepository>,
}

impl CaptureService {
    pub fn new(repository: Arc<dyn CaptureRepository>) -> Self {
        Self { repository }
    }

    pub fn create(&self, content: &str) -> AppResult<Capture> {
        let now = Utc::now().timestamp_millis();
        let capture = Capture {
            id: Uuid::new_v4().to_string(),
            content: normalize_content(content).map_err(AppError::Validation)?,
            status: CaptureStatus::Inbox,
            created_at: now,
            updated_at: now,
            processed_at: None,
        };
        self.repository.insert(&capture)?;
        Ok(capture)
    }

    pub fn list(&self, filter: CaptureFilter) -> AppResult<Vec<Capture>> {
        self.repository.list(filter)
    }

    pub fn update(&self, id: &str, content: &str) -> AppResult<Capture> {
        self.ensure_exists(id, false)?;
        let content = normalize_content(content).map_err(AppError::Validation)?;
        self.repository
            .update_content(id, &content, Utc::now().timestamp_millis())?;
        self.required(id, false)
    }

    pub fn set_status(&self, id: &str, status: CaptureStatus) -> AppResult<Capture> {
        self.ensure_exists(id, false)?;
        let now = Utc::now().timestamp_millis();
        let processed_at = (status == CaptureStatus::Processed).then_some(now);
        self.repository
            .update_status(id, status, now, processed_at)?;
        self.required(id, false)
    }

    pub fn delete(&self, id: &str) -> AppResult<()> {
        self.ensure_exists(id, false)?;
        self.repository
            .soft_delete(id, Utc::now().timestamp_millis())
    }

    pub fn restore(&self, id: &str) -> AppResult<Capture> {
        self.ensure_exists(id, true)?;
        self.repository.restore(id, Utc::now().timestamp_millis())?;
        self.required(id, false)
    }

    fn ensure_exists(&self, id: &str, include_deleted: bool) -> AppResult<()> {
        self.required(id, include_deleted).map(|_| ())
    }

    fn required(&self, id: &str, include_deleted: bool) -> AppResult<Capture> {
        self.repository
            .get(id, include_deleted)?
            .ok_or(AppError::NotFound)
    }
}

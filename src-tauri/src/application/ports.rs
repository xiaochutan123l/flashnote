use crate::{
    domain::capture::{Capture, CaptureFilter, CaptureStatus},
    error::AppResult,
};

/**
 * Persistence port owned by the application layer. SQLite is an implementation
 * detail; a future sync/cache repository can implement the same contract.
 */
pub trait CaptureRepository: Send + Sync {
    fn insert(&self, capture: &Capture) -> AppResult<()>;
    fn list(&self, filter: CaptureFilter) -> AppResult<Vec<Capture>>;
    fn get(&self, id: &str, include_deleted: bool) -> AppResult<Option<Capture>>;
    fn update_content(&self, id: &str, content: &str, updated_at: i64) -> AppResult<()>;
    fn update_status(
        &self,
        id: &str,
        status: CaptureStatus,
        updated_at: i64,
        processed_at: Option<i64>,
    ) -> AppResult<()>;
    fn soft_delete(&self, id: &str, deleted_at: i64) -> AppResult<()>;
    fn restore(&self, id: &str, updated_at: i64) -> AppResult<()>;
}

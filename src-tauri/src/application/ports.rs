use crate::{
    domain::capture::{Capture, CaptureFilter, CaptureStatus},
    domain::planning::{DailyNote, FocusItem, PlanItem},
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

/** Persistence boundary for the cohesive planning/focus area introduced in 2.0. */
pub trait PlanningRepository: Send + Sync {
    fn insert_plan_item(&self, item: &PlanItem) -> AppResult<()>;
    fn list_plan_items(&self) -> AppResult<Vec<PlanItem>>;
    fn get_plan_item(&self, id: &str) -> AppResult<Option<PlanItem>>;
    fn update_plan_title(&self, id: &str, title: &str, updated_at: i64) -> AppResult<()>;
    fn set_plan_completed(
        &self,
        id: &str,
        completed_at: Option<i64>,
        updated_at: i64,
    ) -> AppResult<()>;
    fn soft_delete_plan_tree(&self, id: &str, deleted_at: i64) -> AppResult<()>;

    fn focus_exists(&self, day: &str, plan_item_id: &str) -> AppResult<bool>;
    fn insert_focus_item(&self, item: &FocusItem) -> AppResult<()>;
    fn list_focus_items(&self, day: &str) -> AppResult<Vec<FocusItem>>;
    fn get_focus_item(&self, id: &str) -> AppResult<Option<FocusItem>>;
    fn set_current_focus(&self, id: &str, day: &str, updated_at: i64) -> AppResult<()>;
    fn set_focus_completed(
        &self,
        id: &str,
        completed_at: Option<i64>,
        updated_at: i64,
    ) -> AppResult<()>;
    fn delete_focus_item(&self, id: &str) -> AppResult<()>;

    fn get_daily_note(&self, day: &str) -> AppResult<Option<DailyNote>>;
    fn save_daily_note(&self, note: &DailyNote) -> AppResult<()>;
    fn delete_daily_note(&self, day: &str) -> AppResult<()>;
    fn list_record_days(&self) -> AppResult<Vec<String>>;
}

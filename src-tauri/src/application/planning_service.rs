use std::sync::Arc;

use chrono::Utc;
use uuid::Uuid;

use crate::{
    application::ports::PlanningRepository,
    domain::planning::{
        normalize_note, normalize_title, validate_day, DailyNote, DailyRecord, FocusItem, PlanItem,
    },
    error::{AppError, AppResult},
};

/** Coordinates plans, today's selected work, and date-based journal archives. */
#[derive(Clone)]
pub struct PlanningService {
    repository: Arc<dyn PlanningRepository>,
}

impl PlanningService {
    pub fn new(repository: Arc<dyn PlanningRepository>) -> Self {
        Self { repository }
    }

    pub fn create_plan_item(&self, title: &str, parent_id: Option<&str>) -> AppResult<PlanItem> {
        if let Some(parent_id) = parent_id {
            self.required_plan(parent_id)?;
        }
        let now = Utc::now().timestamp_millis();
        let item = PlanItem {
            id: Uuid::new_v4().to_string(),
            title: normalize_title(title).map_err(AppError::Validation)?,
            parent_id: parent_id.map(str::to_string),
            position: now,
            created_at: now,
            updated_at: now,
            completed_at: None,
        };
        self.repository.insert_plan_item(&item)?;
        Ok(item)
    }

    pub fn list_plan_items(&self) -> AppResult<Vec<PlanItem>> {
        self.repository.list_plan_items()
    }

    pub fn update_plan_item(&self, id: &str, title: &str) -> AppResult<PlanItem> {
        self.required_plan(id)?;
        let title = normalize_title(title).map_err(AppError::Validation)?;
        self.repository
            .update_plan_title(id, &title, Utc::now().timestamp_millis())?;
        self.required_plan(id)
    }

    pub fn set_plan_completed(&self, id: &str, completed: bool) -> AppResult<PlanItem> {
        self.required_plan(id)?;
        let now = Utc::now().timestamp_millis();
        self.repository
            .set_plan_completed(id, completed.then_some(now), now)?;
        self.required_plan(id)
    }

    pub fn delete_plan_item(&self, id: &str) -> AppResult<()> {
        self.required_plan(id)?;
        self.repository
            .soft_delete_plan_tree(id, Utc::now().timestamp_millis())
    }

    pub fn add_plan_to_day(&self, plan_item_id: &str, day: &str) -> AppResult<FocusItem> {
        let day = validate_day(day).map_err(AppError::Validation)?;
        let plan = self.required_plan(plan_item_id)?;
        if self.repository.focus_exists(&day, plan_item_id)? {
            return Err(AppError::Validation("这项计划已经加入当天专注".into()));
        }
        let now = Utc::now().timestamp_millis();
        let item = FocusItem {
            id: Uuid::new_v4().to_string(),
            day,
            plan_item_id: plan.id,
            title: plan.title,
            position: now,
            is_current: false,
            created_at: now,
            updated_at: now,
            completed_at: None,
        };
        self.repository.insert_focus_item(&item)?;
        Ok(item)
    }

    pub fn list_focus_items(&self, day: &str) -> AppResult<Vec<FocusItem>> {
        let day = validate_day(day).map_err(AppError::Validation)?;
        self.repository.list_focus_items(&day)
    }

    pub fn set_current_focus(&self, id: &str) -> AppResult<FocusItem> {
        let item = self.required_focus(id)?;
        if item.completed_at.is_some() {
            return Err(AppError::Validation("已完成事项不能设为当前专注".into()));
        }
        self.repository
            .set_current_focus(id, &item.day, Utc::now().timestamp_millis())?;
        self.required_focus(id)
    }

    pub fn set_focus_completed(&self, id: &str, completed: bool) -> AppResult<FocusItem> {
        self.required_focus(id)?;
        let now = Utc::now().timestamp_millis();
        self.repository
            .set_focus_completed(id, completed.then_some(now), now)?;
        self.required_focus(id)
    }

    pub fn remove_focus_item(&self, id: &str) -> AppResult<()> {
        self.required_focus(id)?;
        self.repository.delete_focus_item(id)
    }

    pub fn get_daily_note(&self, day: &str) -> AppResult<Option<DailyNote>> {
        let day = validate_day(day).map_err(AppError::Validation)?;
        self.repository.get_daily_note(&day)
    }

    pub fn save_daily_note(&self, day: &str, content: &str) -> AppResult<Option<DailyNote>> {
        let day = validate_day(day).map_err(AppError::Validation)?;
        let content = normalize_note(content).map_err(AppError::Validation)?;
        if content.is_empty() {
            self.repository.delete_daily_note(&day)?;
            return Ok(None);
        }
        let note = DailyNote {
            day,
            content,
            updated_at: Utc::now().timestamp_millis(),
        };
        self.repository.save_daily_note(&note)?;
        Ok(Some(note))
    }

    pub fn list_daily_records(&self) -> AppResult<Vec<DailyRecord>> {
        self.repository
            .list_record_days()?
            .into_iter()
            .map(|day| {
                Ok(DailyRecord {
                    focus_items: self.repository.list_focus_items(&day)?,
                    note: self.repository.get_daily_note(&day)?,
                    day,
                })
            })
            .collect()
    }

    fn required_plan(&self, id: &str) -> AppResult<PlanItem> {
        self.repository.get_plan_item(id)?.ok_or(AppError::NotFound)
    }

    fn required_focus(&self, id: &str) -> AppResult<FocusItem> {
        self.repository
            .get_focus_item(id)?
            .ok_or(AppError::NotFound)
    }
}

use std::{
    path::Path,
    sync::{Mutex, MutexGuard},
};

use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::{
    application::ports::PlanningRepository,
    domain::planning::{DailyNote, FocusItem, PlanItem},
    error::{AppError, AppResult},
};

/** SQLite adapter for the 2.0 planning area. It owns no presentation policy. */
pub struct SqlitePlanningRepository {
    connection: Mutex<Connection>,
}

impl SqlitePlanningRepository {
    pub fn open(path: &Path) -> AppResult<Self> {
        let connection = Connection::open(path)?;
        connection.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;
             PRAGMA busy_timeout = 3000;

             CREATE TABLE IF NOT EXISTS plan_items (
                 id           TEXT PRIMARY KEY,
                 title        TEXT NOT NULL,
                 parent_id    TEXT REFERENCES plan_items(id),
                 position     INTEGER NOT NULL,
                 created_at   INTEGER NOT NULL,
                 updated_at   INTEGER NOT NULL,
                 completed_at INTEGER,
                 deleted_at   INTEGER
             );

             CREATE INDEX IF NOT EXISTS idx_plan_items_parent_position
             ON plan_items(parent_id, position, id);

             CREATE TABLE IF NOT EXISTS day_focus_items (
                 id           TEXT PRIMARY KEY,
                 day          TEXT NOT NULL,
                 plan_item_id TEXT NOT NULL REFERENCES plan_items(id),
                 title        TEXT NOT NULL,
                 position     INTEGER NOT NULL,
                 is_current   INTEGER NOT NULL DEFAULT 0 CHECK(is_current IN (0, 1)),
                 created_at   INTEGER NOT NULL,
                 updated_at   INTEGER NOT NULL,
                 completed_at INTEGER,
                 UNIQUE(day, plan_item_id)
             );

             CREATE INDEX IF NOT EXISTS idx_day_focus_day_position
             ON day_focus_items(day, position, id);

             CREATE TABLE IF NOT EXISTS daily_notes (
                 day        TEXT PRIMARY KEY,
                 content    TEXT NOT NULL,
                 updated_at INTEGER NOT NULL
             );",
        )?;
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    fn connection(&self) -> AppResult<MutexGuard<'_, Connection>> {
        self.connection
            .lock()
            .map_err(|_| AppError::Platform("数据库连接锁已损坏".into()))
    }

    fn map_plan(row: &Row<'_>) -> rusqlite::Result<PlanItem> {
        Ok(PlanItem {
            id: row.get("id")?,
            title: row.get("title")?,
            parent_id: row.get("parent_id")?,
            position: row.get("position")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            completed_at: row.get("completed_at")?,
        })
    }

    fn map_focus(row: &Row<'_>) -> rusqlite::Result<FocusItem> {
        Ok(FocusItem {
            id: row.get("id")?,
            day: row.get("day")?,
            plan_item_id: row.get("plan_item_id")?,
            title: row.get("title")?,
            position: row.get("position")?,
            is_current: row.get::<_, i64>("is_current")? != 0,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            completed_at: row.get("completed_at")?,
        })
    }

    fn map_note(row: &Row<'_>) -> rusqlite::Result<DailyNote> {
        Ok(DailyNote {
            day: row.get("day")?,
            content: row.get("content")?,
            updated_at: row.get("updated_at")?,
        })
    }
}

impl PlanningRepository for SqlitePlanningRepository {
    fn insert_plan_item(&self, item: &PlanItem) -> AppResult<()> {
        self.connection()?.execute(
            "INSERT INTO plan_items
             (id, title, parent_id, position, created_at, updated_at, completed_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL)",
            params![
                item.id,
                item.title,
                item.parent_id,
                item.position,
                item.created_at,
                item.updated_at,
                item.completed_at
            ],
        )?;
        Ok(())
    }

    fn list_plan_items(&self) -> AppResult<Vec<PlanItem>> {
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT id, title, parent_id, position, created_at, updated_at, completed_at
             FROM plan_items WHERE deleted_at IS NULL
             ORDER BY position, id",
        )?;
        let items = statement
            .query_map([], Self::map_plan)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(items)
    }

    fn get_plan_item(&self, id: &str) -> AppResult<Option<PlanItem>> {
        Ok(self
            .connection()?
            .query_row(
                "SELECT id, title, parent_id, position, created_at, updated_at, completed_at
                 FROM plan_items WHERE id = ?1 AND deleted_at IS NULL",
                [id],
                Self::map_plan,
            )
            .optional()?)
    }

    fn update_plan_title(&self, id: &str, title: &str, updated_at: i64) -> AppResult<()> {
        self.connection()?.execute(
            "UPDATE plan_items SET title = ?2, updated_at = ?3
             WHERE id = ?1 AND deleted_at IS NULL",
            params![id, title, updated_at],
        )?;
        Ok(())
    }

    fn set_plan_completed(
        &self,
        id: &str,
        completed_at: Option<i64>,
        updated_at: i64,
    ) -> AppResult<()> {
        self.connection()?.execute(
            "UPDATE plan_items SET completed_at = ?2, updated_at = ?3
             WHERE id = ?1 AND deleted_at IS NULL",
            params![id, completed_at, updated_at],
        )?;
        Ok(())
    }

    fn soft_delete_plan_tree(&self, id: &str, deleted_at: i64) -> AppResult<()> {
        self.connection()?.execute(
            "WITH RECURSIVE descendants(id) AS (
                 SELECT ?1
                 UNION ALL
                 SELECT item.id
                 FROM plan_items item
                 JOIN descendants parent ON item.parent_id = parent.id
                 WHERE item.deleted_at IS NULL
             )
             UPDATE plan_items
             SET deleted_at = ?2, updated_at = ?2
             WHERE id IN (SELECT id FROM descendants)",
            params![id, deleted_at],
        )?;
        Ok(())
    }

    fn focus_exists(&self, day: &str, plan_item_id: &str) -> AppResult<bool> {
        Ok(self.connection()?.query_row(
            "SELECT EXISTS(
                 SELECT 1 FROM day_focus_items WHERE day = ?1 AND plan_item_id = ?2
             )",
            params![day, plan_item_id],
            |row| row.get::<_, i64>(0),
        )? != 0)
    }

    fn insert_focus_item(&self, item: &FocusItem) -> AppResult<()> {
        self.connection()?.execute(
            "INSERT INTO day_focus_items
             (id, day, plan_item_id, title, position, is_current,
              created_at, updated_at, completed_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                item.id,
                item.day,
                item.plan_item_id,
                item.title,
                item.position,
                i64::from(item.is_current),
                item.created_at,
                item.updated_at,
                item.completed_at
            ],
        )?;
        Ok(())
    }

    fn list_focus_items(&self, day: &str) -> AppResult<Vec<FocusItem>> {
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT id, day, plan_item_id, title, position, is_current,
                    created_at, updated_at, completed_at
             FROM day_focus_items WHERE day = ?1
             ORDER BY position, id",
        )?;
        let items = statement
            .query_map([day], Self::map_focus)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(items)
    }

    fn get_focus_item(&self, id: &str) -> AppResult<Option<FocusItem>> {
        Ok(self
            .connection()?
            .query_row(
                "SELECT id, day, plan_item_id, title, position, is_current,
                        created_at, updated_at, completed_at
                 FROM day_focus_items WHERE id = ?1",
                [id],
                Self::map_focus,
            )
            .optional()?)
    }

    fn set_current_focus(&self, id: &str, day: &str, updated_at: i64) -> AppResult<()> {
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        transaction.execute(
            "UPDATE day_focus_items
             SET is_current = 0, updated_at = ?2
             WHERE day = ?1 AND is_current = 1",
            params![day, updated_at],
        )?;
        transaction.execute(
            "UPDATE day_focus_items
             SET is_current = 1, updated_at = ?2
             WHERE id = ?1 AND completed_at IS NULL",
            params![id, updated_at],
        )?;
        transaction.commit()?;
        Ok(())
    }

    fn set_focus_completed(
        &self,
        id: &str,
        completed_at: Option<i64>,
        updated_at: i64,
    ) -> AppResult<()> {
        self.connection()?.execute(
            "UPDATE day_focus_items
             SET completed_at = ?2,
                 is_current = CASE WHEN ?2 IS NULL THEN is_current ELSE 0 END,
                 updated_at = ?3
             WHERE id = ?1",
            params![id, completed_at, updated_at],
        )?;
        Ok(())
    }

    fn delete_focus_item(&self, id: &str) -> AppResult<()> {
        self.connection()?
            .execute("DELETE FROM day_focus_items WHERE id = ?1", [id])?;
        Ok(())
    }

    fn get_daily_note(&self, day: &str) -> AppResult<Option<DailyNote>> {
        Ok(self
            .connection()?
            .query_row(
                "SELECT day, content, updated_at FROM daily_notes WHERE day = ?1",
                [day],
                Self::map_note,
            )
            .optional()?)
    }

    fn save_daily_note(&self, note: &DailyNote) -> AppResult<()> {
        self.connection()?.execute(
            "INSERT INTO daily_notes(day, content, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(day) DO UPDATE SET
                 content = excluded.content,
                 updated_at = excluded.updated_at",
            params![note.day, note.content, note.updated_at],
        )?;
        Ok(())
    }

    fn delete_daily_note(&self, day: &str) -> AppResult<()> {
        self.connection()?
            .execute("DELETE FROM daily_notes WHERE day = ?1", [day])?;
        Ok(())
    }

    fn list_record_days(&self) -> AppResult<Vec<String>> {
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT day FROM (
                 SELECT day FROM day_focus_items
                 UNION
                 SELECT day FROM daily_notes WHERE content <> ''
             )
             ORDER BY day DESC",
        )?;
        let days = statement
            .query_map([], |row| row.get(0))?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(days)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::planning_service::PlanningService;
    use std::sync::Arc;

    fn service() -> PlanningService {
        PlanningService::new(Arc::new(
            SqlitePlanningRepository::open(Path::new(":memory:")).unwrap(),
        ))
    }

    #[test]
    fn plans_focus_and_daily_archive_share_a_coherent_lifecycle() {
        let service = service();
        let plan = service
            .create_plan_item("完成 Flashnote 2.0", None)
            .unwrap();
        let child = service
            .create_plan_item("实现今日专注", Some(&plan.id))
            .unwrap();
        let focus = service.add_plan_to_day(&child.id, "2026-07-23").unwrap();

        assert!(service.set_current_focus(&focus.id).unwrap().is_current);
        let completed = service.set_focus_completed(&focus.id, true).unwrap();
        assert!(completed.completed_at.is_some());
        assert!(!completed.is_current);

        service
            .save_daily_note("2026-07-23", "今天完成了核心交互。")
            .unwrap();
        let records = service.list_daily_records().unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].focus_items.len(), 1);
        assert_eq!(
            records[0].note.as_ref().unwrap().content,
            "今天完成了核心交互。"
        );

        service.delete_plan_item(&plan.id).unwrap();
        assert!(service.list_plan_items().unwrap().is_empty());
        assert_eq!(service.list_focus_items("2026-07-23").unwrap().len(), 1);
    }
}

use std::{
    path::Path,
    sync::{Mutex, MutexGuard},
};

use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::{
    application::ports::CaptureRepository,
    domain::capture::{Capture, CaptureFilter, CaptureStatus},
    error::{AppError, AppResult},
};

/** SQLite adapter. One serialized connection is sufficient for this local inbox. */
pub struct SqliteCaptureRepository {
    connection: Mutex<Connection>,
}

impl SqliteCaptureRepository {
    pub fn open(path: &Path) -> AppResult<Self> {
        let connection = Connection::open(path)?;
        connection.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;
             PRAGMA busy_timeout = 3000;

             CREATE TABLE IF NOT EXISTS captures (
                 id            TEXT PRIMARY KEY,
                 content       TEXT NOT NULL,
                 status        TEXT NOT NULL CHECK(status IN ('inbox', 'processed')),
                 created_at    INTEGER NOT NULL,
                 updated_at    INTEGER NOT NULL,
                 processed_at  INTEGER,
                 deleted_at    INTEGER
             );

             CREATE INDEX IF NOT EXISTS idx_captures_visible_created
             ON captures(deleted_at, created_at DESC);

             CREATE INDEX IF NOT EXISTS idx_captures_status_created
             ON captures(status, created_at DESC);",
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

    fn map_capture(row: &Row<'_>) -> rusqlite::Result<Capture> {
        let status_value: String = row.get("status")?;
        let status = CaptureStatus::parse(&status_value).ok_or(rusqlite::Error::InvalidQuery)?;
        Ok(Capture {
            id: row.get("id")?,
            content: row.get("content")?,
            status,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            processed_at: row.get("processed_at")?,
        })
    }
}

impl CaptureRepository for SqliteCaptureRepository {
    fn insert(&self, capture: &Capture) -> AppResult<()> {
        self.connection()?.execute(
            "INSERT INTO captures
             (id, content, status, created_at, updated_at, processed_at, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, NULL)",
            params![
                capture.id,
                capture.content,
                capture.status.as_str(),
                capture.created_at,
                capture.updated_at,
                capture.processed_at
            ],
        )?;
        Ok(())
    }

    fn list(&self, filter: CaptureFilter) -> AppResult<Vec<Capture>> {
        let connection = self.connection()?;
        let (sql, status): (&str, Option<&str>) = match filter {
            CaptureFilter::All => (
                "SELECT id, content, status, created_at, updated_at, processed_at
                 FROM captures WHERE deleted_at IS NULL ORDER BY created_at DESC",
                None,
            ),
            CaptureFilter::Inbox => (
                "SELECT id, content, status, created_at, updated_at, processed_at
                 FROM captures WHERE deleted_at IS NULL AND status = ?1 ORDER BY created_at DESC",
                Some("inbox"),
            ),
            CaptureFilter::Processed => (
                "SELECT id, content, status, created_at, updated_at, processed_at
                 FROM captures WHERE deleted_at IS NULL AND status = ?1 ORDER BY created_at DESC",
                Some("processed"),
            ),
        };
        let mut statement = connection.prepare(sql)?;
        let rows = match status {
            Some(status) => statement.query_map([status], Self::map_capture)?,
            None => statement.query_map([], Self::map_capture)?,
        };
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    fn get(&self, id: &str, include_deleted: bool) -> AppResult<Option<Capture>> {
        let connection = self.connection()?;
        let deleted_clause = if include_deleted {
            ""
        } else {
            " AND deleted_at IS NULL"
        };
        let sql = format!(
            "SELECT id, content, status, created_at, updated_at, processed_at
             FROM captures WHERE id = ?1{deleted_clause}"
        );
        Ok(connection
            .query_row(&sql, [id], Self::map_capture)
            .optional()?)
    }

    fn update_content(&self, id: &str, content: &str, updated_at: i64) -> AppResult<()> {
        self.connection()?.execute(
            "UPDATE captures SET content = ?2, updated_at = ?3
             WHERE id = ?1 AND deleted_at IS NULL",
            params![id, content, updated_at],
        )?;
        Ok(())
    }

    fn update_status(
        &self,
        id: &str,
        status: CaptureStatus,
        updated_at: i64,
        processed_at: Option<i64>,
    ) -> AppResult<()> {
        self.connection()?.execute(
            "UPDATE captures SET status = ?2, updated_at = ?3, processed_at = ?4
             WHERE id = ?1 AND deleted_at IS NULL",
            params![id, status.as_str(), updated_at, processed_at],
        )?;
        Ok(())
    }

    fn soft_delete(&self, id: &str, deleted_at: i64) -> AppResult<()> {
        self.connection()?.execute(
            "UPDATE captures SET deleted_at = ?2, updated_at = ?2
             WHERE id = ?1 AND deleted_at IS NULL",
            params![id, deleted_at],
        )?;
        Ok(())
    }

    fn restore(&self, id: &str, updated_at: i64) -> AppResult<()> {
        self.connection()?.execute(
            "UPDATE captures SET deleted_at = NULL, updated_at = ?2 WHERE id = ?1",
            params![id, updated_at],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::application::capture_service::CaptureService;
    use std::sync::Arc;

    fn service() -> CaptureService {
        let repository = SqliteCaptureRepository::open(Path::new(":memory:")).unwrap();
        CaptureService::new(Arc::new(repository))
    }

    #[test]
    fn capture_lifecycle_is_persisted() {
        let service = service();
        let capture = service.create("稍后阅读这篇文章").unwrap();
        assert_eq!(service.list(CaptureFilter::Inbox).unwrap().len(), 1);

        service
            .set_status(&capture.id, CaptureStatus::Processed)
            .unwrap();
        assert!(service.list(CaptureFilter::Inbox).unwrap().is_empty());
        assert_eq!(service.list(CaptureFilter::Processed).unwrap().len(), 1);

        service.delete(&capture.id).unwrap();
        assert!(service.list(CaptureFilter::All).unwrap().is_empty());

        service.restore(&capture.id).unwrap();
        assert_eq!(service.list(CaptureFilter::All).unwrap().len(), 1);
    }
}

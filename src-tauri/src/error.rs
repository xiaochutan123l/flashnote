use thiserror::Error;

pub type AppResult<T> = Result<T, AppError>;

/** Internal errors retain their category; only the command layer turns them into strings. */
#[derive(Debug, Error)]
pub enum AppError {
    #[error("{0}")]
    Validation(String),
    #[error("记录不存在")]
    NotFound,
    #[error("数据存储失败：{0}")]
    Storage(#[from] rusqlite::Error),
    #[error("系统操作失败：{0}")]
    Platform(String),
}

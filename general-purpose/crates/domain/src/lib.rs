pub mod note;

pub use note::{DomainError, Note, NoteBody};

use std::future::Future;
use std::pin::Pin;

pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
    #[error("the store is unavailable: {0}")]
    Unavailable(String),
}

pub trait NoteStore: Send + Sync {
    fn insert<'a>(&'a self, body: &'a NoteBody) -> BoxFuture<'a, Result<Note, StoreError>>;
    fn list(&self) -> BoxFuture<'_, Result<Vec<Note>, StoreError>>;
    fn ping(&self) -> BoxFuture<'_, Result<(), StoreError>>;
}

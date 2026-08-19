pub mod migrations;

use domain::{BoxFuture, Note, NoteBody, NoteStore, StoreError};
use futures::TryStreamExt;
use mongodb::bson::oid::ObjectId;
use mongodb::bson::{DateTime, doc};
use mongodb::options::IndexOptions;
use mongodb::{Collection, Database, IndexModel};
use serde::{Deserialize, Serialize};

pub const NOTES_COLLECTION: &str = "notes";
pub const CREATED_AT_INDEX: &str = "created_at_desc";

#[derive(Debug, Serialize, Deserialize)]
pub struct NoteDocument {
    #[serde(rename = "_id")]
    pub id: ObjectId,
    pub body: String,
    pub created_at: DateTime,
    pub schema_version: i32,
}

pub fn notes_json_schema() -> mongodb::bson::Document {
    doc! {
        "bsonType": "object",
        "required": ["_id", "body", "created_at", "schema_version"],
        "properties": {
            "body": { "bsonType": "string", "minLength": 1 },
            "created_at": { "bsonType": "date" },
            "schema_version": { "bsonType": "int" },
        },
    }
}

#[derive(Clone)]
pub struct MongoNoteStore {
    database: Database,
    notes: Collection<NoteDocument>,
}

impl MongoNoteStore {
    pub async fn initialize(database: Database) -> Result<Self, StoreError> {
        migrations::apply(&database).await?;
        ensure_validator(&database).await?;
        let notes = database.collection::<NoteDocument>(NOTES_COLLECTION);
        ensure_indexes(&notes).await?;
        Ok(Self { database, notes })
    }
}

async fn ensure_validator(database: &Database) -> Result<(), StoreError> {
    database
        .run_command(doc! {
            "collMod": NOTES_COLLECTION,
            "validator": { "$jsonSchema": notes_json_schema() },
            "validationLevel": "strict",
            "validationAction": "error",
        })
        .await
        .map_err(unavailable)?;
    Ok(())
}

async fn ensure_indexes(notes: &Collection<NoteDocument>) -> Result<(), StoreError> {
    notes
        .create_index(
            IndexModel::builder()
                .keys(doc! { "created_at": -1 })
                .options(
                    IndexOptions::builder()
                        .name(CREATED_AT_INDEX.to_owned())
                        .build(),
                )
                .build(),
        )
        .await
        .map_err(unavailable)?;
    Ok(())
}

fn unavailable(error: mongodb::error::Error) -> StoreError {
    StoreError::Unavailable(error.to_string())
}

fn to_note(document: NoteDocument) -> Result<Note, StoreError> {
    let body = NoteBody::new(&document.body).map_err(|violation| {
        StoreError::Unavailable(format!("a stored note violates the domain: {violation}"))
    })?;
    Ok(Note {
        id: document.id.to_hex(),
        body,
        created_at: document
            .created_at
            .try_to_rfc3339_string()
            .map_err(|error| {
                StoreError::Unavailable(format!("a stored timestamp is unrepresentable: {error}"))
            })?,
    })
}

impl NoteStore for MongoNoteStore {
    fn insert<'a>(&'a self, body: &'a NoteBody) -> BoxFuture<'a, Result<Note, StoreError>> {
        Box::pin(async move {
            let document = NoteDocument {
                id: ObjectId::new(),
                body: body.as_str().to_owned(),
                created_at: DateTime::now(),
                schema_version: migrations::SCHEMA_VERSION,
            };
            self.notes
                .insert_one(&document)
                .await
                .map_err(unavailable)?;
            to_note(document)
        })
    }

    fn list(&self) -> BoxFuture<'_, Result<Vec<Note>, StoreError>> {
        Box::pin(async move {
            let documents: Vec<NoteDocument> = self
                .notes
                .find(doc! {})
                .sort(doc! { "created_at": -1 })
                .await
                .map_err(unavailable)?
                .try_collect()
                .await
                .map_err(unavailable)?;
            documents.into_iter().map(to_note).collect()
        })
    }

    fn ping(&self) -> BoxFuture<'_, Result<(), StoreError>> {
        Box::pin(async move {
            self.database
                .run_command(doc! { "ping": 1 })
                .await
                .map_err(unavailable)?;
            Ok(())
        })
    }
}

use domain::StoreError;
use mongodb::Database;
use mongodb::bson::{DateTime, doc};
use serde::{Deserialize, Serialize};

pub const SCHEMA_VERSION: i32 = 1;
pub const LEDGER_COLLECTION: &str = "schema_migrations";

#[derive(Debug, Serialize, Deserialize)]
pub struct AppliedMigration {
    #[serde(rename = "_id")]
    pub version: i32,
    pub description: String,
    pub applied_at: DateTime,
}

struct Migration {
    version: i32,
    description: &'static str,
    apply: fn(&Database) -> domain::BoxFuture<'_, Result<(), StoreError>>,
}

const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    description: "create the notes collection with its schema validator",
    apply: |database| {
        Box::pin(async move {
            let existing = database
                .list_collection_names()
                .await
                .map_err(|error| StoreError::Unavailable(error.to_string()))?;
            if !existing.iter().any(|name| name == super::NOTES_COLLECTION) {
                database
                    .create_collection(super::NOTES_COLLECTION)
                    .await
                    .map_err(|error| StoreError::Unavailable(error.to_string()))?;
            }
            Ok(())
        })
    },
}];

pub async fn apply(database: &Database) -> Result<(), StoreError> {
    let ledger = database.collection::<AppliedMigration>(LEDGER_COLLECTION);
    for migration in MIGRATIONS {
        let applied = ledger
            .find_one(doc! { "_id": migration.version })
            .await
            .map_err(|error| StoreError::Unavailable(error.to_string()))?;
        if applied.is_some() {
            continue;
        }
        (migration.apply)(database).await?;
        ledger
            .insert_one(AppliedMigration {
                version: migration.version,
                description: migration.description.to_owned(),
                applied_at: DateTime::now(),
            })
            .await
            .map_err(|error| StoreError::Unavailable(error.to_string()))?;
    }
    Ok(())
}

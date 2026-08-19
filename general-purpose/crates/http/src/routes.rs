use axum::Json;
use axum::extract::State;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use domain::{Note, NoteBody};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::AppState;
use crate::error::{ApiError, Problem, problem};
use crate::extract::ValidatedJson;

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct NoteResponse {
    pub id: String,
    pub body: String,
    pub created_at: String,
}

impl From<Note> for NoteResponse {
    fn from(note: Note) -> Self {
        Self {
            id: note.id,
            body: note.body.as_str().to_owned(),
            created_at: note.created_at,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(deny_unknown_fields)]
pub struct CreateNote {
    pub body: String,
}

#[utoipa::path(
    get,
    path = "/api/notes",
    operation_id = "list_notes",
    responses(
        (status = 200, description = "every note, newest first", body = [NoteResponse]),
        (status = 503, description = "the store is unavailable", body = Problem, content_type = "application/problem+json"),
    )
)]
pub async fn list_notes(
    State(state): State<AppState>,
) -> Result<Json<Vec<NoteResponse>>, ApiError> {
    let notes = state.store.list().await?;
    Ok(Json(notes.into_iter().map(NoteResponse::from).collect()))
}

#[utoipa::path(
    post,
    path = "/api/notes",
    operation_id = "create_note",
    request_body = CreateNote,
    responses(
        (status = 201, description = "the created note", body = NoteResponse),
        (status = 400, description = "malformed body", body = Problem, content_type = "application/problem+json"),
        (status = 403, description = "mutation without its origin header", body = Problem, content_type = "application/problem+json"),
        (status = 422, description = "a domain invariant refused the note", body = Problem, content_type = "application/problem+json"),
        (status = 503, description = "the store is unavailable", body = Problem, content_type = "application/problem+json"),
    )
)]
pub async fn create_note(
    State(state): State<AppState>,
    ValidatedJson(request): ValidatedJson<CreateNote>,
) -> Result<(StatusCode, Json<NoteResponse>), ApiError> {
    let body = NoteBody::new(&request.body)?;
    let note = state.store.insert(&body).await?;
    Ok((StatusCode::CREATED, Json(NoteResponse::from(note))))
}

#[utoipa::path(
    get,
    path = "/healthz",
    operation_id = "liveness",
    responses((status = 200, description = "the process is alive"))
)]
pub async fn liveness() -> StatusCode {
    StatusCode::OK
}

#[utoipa::path(
    get,
    path = "/readyz",
    operation_id = "readiness",
    responses(
        (status = 200, description = "the store answers"),
        (status = 503, description = "the store does not answer", body = Problem, content_type = "application/problem+json"),
    )
)]
pub async fn readiness(State(state): State<AppState>) -> Response {
    match state.store.ping().await {
        Ok(()) => StatusCode::OK.into_response(),
        Err(cause) => {
            tracing::warn!(cause = %cause, "readiness refused");
            problem(
                StatusCode::SERVICE_UNAVAILABLE,
                "the service is not ready",
                None,
            )
        }
    }
}

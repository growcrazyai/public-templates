use axum::Json;
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use domain::{DomainError, StoreError};
use serde::Serialize;
use utoipa::ToSchema;

pub const PROBLEM_CONTENT_TYPE: &str = "application/problem+json";

#[derive(Debug, Serialize, ToSchema)]
pub struct Problem {
    #[serde(rename = "type")]
    pub kind: String,
    pub title: String,
    pub status: u16,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum ApiError {
    #[error("the request body is not admissible")]
    Invalid(#[from] DomainError),
    #[error("the request body is malformed")]
    Malformed(String),
    #[error("the store is unavailable")]
    Unavailable(#[from] StoreError),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        match self {
            ApiError::Invalid(violation) => problem(
                StatusCode::UNPROCESSABLE_ENTITY,
                "the request violates a domain invariant",
                Some(violation.to_string()),
            ),
            ApiError::Malformed(detail) => problem(
                StatusCode::BAD_REQUEST,
                "the request body is malformed",
                Some(detail),
            ),
            ApiError::Unavailable(cause) => {
                tracing::error!(cause = %cause, "refusing a request the store cannot serve");
                problem(
                    StatusCode::SERVICE_UNAVAILABLE,
                    "the service is not ready",
                    None,
                )
            }
        }
    }
}

pub fn problem(status: StatusCode, title: &str, detail: Option<String>) -> Response {
    let body = Problem {
        kind: "about:blank".to_owned(),
        title: title.to_owned(),
        status: status.as_u16(),
        detail,
    };
    let mut response = (status, Json(body)).into_response();
    response.headers_mut().insert(
        axum::http::header::CONTENT_TYPE,
        axum::http::HeaderValue::from_static(PROBLEM_CONTENT_TYPE),
    );
    response
}

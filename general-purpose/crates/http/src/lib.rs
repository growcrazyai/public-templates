pub mod error;
pub mod extract;
pub mod routes;

use std::sync::Arc;
use std::time::Duration;

use axum::Router;
use axum::http::{HeaderName, Method, StatusCode};
use domain::NoteStore;
use tower_http::limit::RequestBodyLimitLayer;
use tower_http::timeout::TimeoutLayer;
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;
use utoipa_axum::router::OpenApiRouter;
use utoipa_axum::routes;

pub const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
pub const BODY_BYTE_LIMIT: usize = 64 * 1024;
pub const MUTATION_HEADER: &str = "x-requested-by";

#[derive(Clone)]
pub struct AppState {
    pub store: Arc<dyn NoteStore>,
}

#[derive(OpenApi)]
#[openapi(info(title = "gcai-project", version = "0.1.0"))]
struct ApiDoc;

pub fn api() -> (Router<AppState>, utoipa::openapi::OpenApi) {
    let (router, openapi) = OpenApiRouter::with_openapi(ApiDoc::openapi())
        .routes(routes!(routes::list_notes, routes::create_note))
        .routes(routes!(routes::liveness))
        .routes(routes!(routes::readiness))
        .split_for_parts();
    let router = router
        .layer(axum::middleware::from_fn(require_mutation_header))
        .layer(TraceLayer::new_for_http())
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            REQUEST_TIMEOUT,
        ))
        .layer(RequestBodyLimitLayer::new(BODY_BYTE_LIMIT));
    (router, openapi)
}

async fn require_mutation_header(
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let is_mutation = !matches!(
        *request.method(),
        Method::GET | Method::HEAD | Method::OPTIONS
    );
    if is_mutation
        && !request
            .headers()
            .contains_key(HeaderName::from_static(MUTATION_HEADER))
    {
        return error::problem(
            StatusCode::FORBIDDEN,
            "a mutation must declare its origin",
            Some(format!("send the {MUTATION_HEADER} header")),
        );
    }
    next.run(request).await
}

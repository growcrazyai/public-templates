use axum::extract::rejection::JsonRejection;
use axum::extract::{FromRequest, Request};

use crate::error::ApiError;

pub struct ValidatedJson<T>(pub T);

impl<S, T> FromRequest<S> for ValidatedJson<T>
where
    S: Send + Sync,
    T: serde::de::DeserializeOwned,
{
    type Rejection = ApiError;

    async fn from_request(request: Request, state: &S) -> Result<Self, Self::Rejection> {
        let axum::Json(value) = axum::Json::<T>::from_request(request, state)
            .await
            .map_err(|rejection: JsonRejection| ApiError::Malformed(rejection.body_text()))?;
        Ok(Self(value))
    }
}

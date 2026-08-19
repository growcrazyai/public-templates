use serde::{Deserialize, Serialize};

pub const BODY_CHAR_CEILING: usize = 4096;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum DomainError {
    #[error("a note body must not be empty")]
    EmptyBody,
    #[error("a note body must be at most {BODY_CHAR_CEILING} characters; got {0}")]
    BodyTooLong(usize),
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(transparent)]
pub struct NoteBody(String);

impl NoteBody {
    pub fn new(raw: &str) -> Result<Self, DomainError> {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return Err(DomainError::EmptyBody);
        }
        let length = trimmed.chars().count();
        if length > BODY_CHAR_CEILING {
            return Err(DomainError::BodyTooLong(length));
        }
        Ok(Self(trimmed.to_owned()))
    }

    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Note {
    pub id: String,
    pub body: NoteBody,
    pub created_at: String,
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn a_body_carries_its_trimmed_text() {
        let body = NoteBody::new("  a first note  ").unwrap();
        assert_eq!(body.as_str(), "a first note");
    }

    #[test]
    fn an_empty_body_is_refused() {
        assert_eq!(NoteBody::new("   "), Err(DomainError::EmptyBody));
    }

    #[test]
    fn an_oversized_body_is_refused_by_character_count() {
        let oversized = "x".repeat(BODY_CHAR_CEILING + 1);
        assert_eq!(
            NoteBody::new(&oversized),
            Err(DomainError::BodyTooLong(BODY_CHAR_CEILING + 1))
        );
    }

    #[test]
    fn a_body_at_the_ceiling_is_admitted() {
        let at_ceiling = "x".repeat(BODY_CHAR_CEILING);
        assert!(NoteBody::new(&at_ceiling).is_ok());
    }
}

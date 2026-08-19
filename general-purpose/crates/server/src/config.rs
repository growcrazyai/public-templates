use std::net::SocketAddr;

pub const STORE_URI_VAR: &str = "MONGODB_URI";
pub const BIND_ADDR_VAR: &str = "BIND_ADDR";
pub const DEFAULT_BIND_ADDR: &str = "127.0.0.1:8080";
pub const DATABASE_NAME: &str = "app";

#[derive(Debug, Clone)]
pub struct Config {
    pub store_uri: String,
    pub bind_addr: SocketAddr,
}

#[derive(Debug, thiserror::Error)]
pub enum ConfigError {
    #[error("{STORE_URI_VAR} must be set to the document store's connection string")]
    MissingStoreUri,
    #[error("{BIND_ADDR_VAR} is not a socket address: {0}")]
    MalformedBindAddr(String),
}

impl Config {
    pub fn from_env() -> Result<Self, ConfigError> {
        let store_uri = std::env::var(STORE_URI_VAR).map_err(|_| ConfigError::MissingStoreUri)?;
        let bind_addr = std::env::var(BIND_ADDR_VAR)
            .unwrap_or_else(|_| DEFAULT_BIND_ADDR.to_owned())
            .parse::<SocketAddr>()
            .map_err(|error| ConfigError::MalformedBindAddr(error.to_string()))?;
        Ok(Self {
            store_uri,
            bind_addr,
        })
    }
}

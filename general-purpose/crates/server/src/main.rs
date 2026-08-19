mod config;

use std::process::ExitCode;
use std::sync::Arc;

use http_boundary::AppState;
use store_mongo::MongoNoteStore;
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> ExitCode {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();
    match run().await {
        Ok(()) => ExitCode::SUCCESS,
        Err(refusal) => {
            tracing::error!("{refusal}");
            ExitCode::FAILURE
        }
    }
}

async fn run() -> Result<(), String> {
    let config = config::Config::from_env().map_err(|error| error.to_string())?;
    let client = mongodb::Client::with_uri_str(&config.store_uri)
        .await
        .map_err(|error| format!("the store address is unusable: {error}"))?;
    let store = MongoNoteStore::initialize(client.database(config::DATABASE_NAME))
        .await
        .map_err(|error| format!("the store did not initialize: {error}"))?;

    let (router, _openapi) = http_boundary::api();
    let app = router.with_state(AppState {
        store: Arc::new(store),
    });

    let listener = tokio::net::TcpListener::bind(config.bind_addr)
        .await
        .map_err(|error| format!("cannot bind {}: {error}", config.bind_addr))?;
    tracing::info!(address = %config.bind_addr, "serving");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(|error| format!("the server stopped abnormally: {error}"))
}

async fn shutdown_signal() {
    let interrupt = async {
        tokio::signal::ctrl_c().await.ok();
    };
    #[cfg(unix)]
    let terminate = async {
        use tokio::signal::unix::{SignalKind, signal};
        match signal(SignalKind::terminate()) {
            Ok(mut stream) => {
                stream.recv().await;
            }
            Err(_) => std::future::pending::<()>().await,
        }
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        () = interrupt => {}
        () = terminate => {}
    }
}

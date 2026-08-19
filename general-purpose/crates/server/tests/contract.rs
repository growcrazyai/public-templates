#![allow(clippy::unwrap_used, clippy::expect_used, clippy::panic)]
use std::collections::BTreeSet;
use std::sync::Arc;

use http_boundary::AppState;
use store_mongo::MongoNoteStore;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

const STORE_URI_VAR: &str = "MONGODB_URI";
const MUTATION_HEADER: &str = "x-requested-by";
const PROBLEM_CONTENT_TYPE: &str = "application/problem+json";

fn store_uri() -> String {
    std::env::var(STORE_URI_VAR).unwrap_or_else(|_| {
        panic!("{STORE_URI_VAR} is not set; contract tests run inside `just gate`, which boots the ephemeral store")
    })
}

struct Exchange {
    status: u16,
    content_type: String,
    body: String,
}

async fn exchange(
    address: std::net::SocketAddr,
    method: &str,
    path: &str,
    headers: &[(&str, &str)],
    body: Option<&str>,
) -> Exchange {
    let mut request =
        format!("{method} {path} HTTP/1.1\r\nhost: {address}\r\nconnection: close\r\n");
    for (name, value) in headers {
        request.push_str(&format!("{name}: {value}\r\n"));
    }
    if let Some(body) = body {
        request.push_str(&format!(
            "content-type: application/json\r\ncontent-length: {}\r\n\r\n{body}",
            body.len()
        ));
    } else {
        request.push_str("\r\n");
    }
    let mut stream = tokio::net::TcpStream::connect(address)
        .await
        .expect("the server accepts");
    stream
        .write_all(request.as_bytes())
        .await
        .expect("the request is written");
    let mut raw = Vec::new();
    stream
        .read_to_end(&mut raw)
        .await
        .expect("the response is read");
    let raw = String::from_utf8(raw).expect("the response is text");
    let (head, tail) = raw
        .split_once("\r\n\r\n")
        .expect("the response has a header block");
    let status = head
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|code| code.parse::<u16>().ok())
        .expect("the status line names a code");
    let content_type = head
        .lines()
        .find_map(|line| line.strip_prefix("content-type: "))
        .unwrap_or("")
        .to_owned();
    let body = if head
        .to_ascii_lowercase()
        .contains("transfer-encoding: chunked")
    {
        dechunk(tail)
    } else {
        tail.to_owned()
    };
    Exchange {
        status,
        content_type,
        body,
    }
}

fn dechunk(tail: &str) -> String {
    let mut out = String::new();
    let mut rest = tail;
    while let Some((size, after)) = rest.split_once("\r\n") {
        let Ok(size) = usize::from_str_radix(size.trim(), 16) else {
            break;
        };
        if size == 0 {
            break;
        }
        out.push_str(&after[..size]);
        rest = &after[size + 2..];
    }
    out
}

struct Harness {
    address: std::net::SocketAddr,
    spec: serde_json::Value,
    exercised: std::sync::Mutex<BTreeSet<(String, String)>>,
}

impl Harness {
    async fn boot() -> Self {
        let client = mongodb::Client::with_uri_str(&store_uri())
            .await
            .expect("the store address parses");
        let database = client.database(&format!("contract_{}", std::process::id()));
        database.drop().await.expect("a clean database");
        let store = MongoNoteStore::initialize(database)
            .await
            .expect("the store initializes");
        let (router, openapi) = http_boundary::api();
        let app = router.with_state(AppState {
            store: Arc::new(store),
        });
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("port 0 binds");
        let address = listener.local_addr().expect("the bound address is known");
        tokio::spawn(async move {
            axum::serve(listener, app).await.expect("the server runs");
        });
        let spec = serde_json::to_value(&openapi).expect("the contract serializes");
        Self {
            address,
            spec,
            exercised: std::sync::Mutex::new(BTreeSet::new()),
        }
    }

    async fn call(
        &self,
        method: &str,
        path: &str,
        template: &str,
        headers: &[(&str, &str)],
        body: Option<&str>,
    ) -> Exchange {
        self.exercised
            .lock()
            .expect("the coverage set")
            .insert((method.to_ascii_lowercase(), template.to_owned()));
        exchange(self.address, method, path, headers, body).await
    }
}

#[tokio::test]
async fn the_contract_holds_across_the_real_seam() {
    let harness = Harness::boot().await;
    let mutation = [(MUTATION_HEADER, "contract-test")];

    let alive = harness.call("GET", "/healthz", "/healthz", &[], None).await;
    assert_eq!(alive.status, 200);

    let ready = harness.call("GET", "/readyz", "/readyz", &[], None).await;
    assert_eq!(ready.status, 200);

    let empty = harness
        .call("GET", "/api/notes", "/api/notes", &[], None)
        .await;
    assert_eq!(empty.status, 200);
    assert_eq!(empty.body.trim(), "[]");

    let created = harness
        .call(
            "POST",
            "/api/notes",
            "/api/notes",
            &mutation,
            Some(r#"{"body":"a first note"}"#),
        )
        .await;
    assert_eq!(created.status, 201, "{}", created.body);
    let note: serde_json::Value = serde_json::from_str(&created.body).expect("the note is json");
    assert_eq!(note["body"], "a first note");
    assert!(note["id"].as_str().is_some_and(|id| !id.is_empty()));
    assert!(note["createdAt"].as_str().is_some());

    let listed = harness
        .call("GET", "/api/notes", "/api/notes", &[], None)
        .await;
    let notes: serde_json::Value = serde_json::from_str(&listed.body).expect("the list is json");
    assert_eq!(notes.as_array().map(Vec::len), Some(1));

    let refused = harness
        .call(
            "POST",
            "/api/notes",
            "/api/notes",
            &mutation,
            Some(r#"{"body":"   "}"#),
        )
        .await;
    assert_eq!(refused.status, 422);
    assert_eq!(refused.content_type, PROBLEM_CONTENT_TYPE);
    let problem: serde_json::Value =
        serde_json::from_str(&refused.body).expect("the refusal is json");
    assert_eq!(problem["status"], 422);
    assert!(problem["title"].as_str().is_some());

    let unknown_field = harness
        .call(
            "POST",
            "/api/notes",
            "/api/notes",
            &mutation,
            Some(r#"{"body":"x","admin":true}"#),
        )
        .await;
    assert_eq!(unknown_field.status, 400);
    assert_eq!(unknown_field.content_type, PROBLEM_CONTENT_TYPE);

    let headerless = harness
        .call(
            "POST",
            "/api/notes",
            "/api/notes",
            &[],
            Some(r#"{"body":"x"}"#),
        )
        .await;
    assert_eq!(headerless.status, 403);
    assert_eq!(headerless.content_type, PROBLEM_CONTENT_TYPE);

    let coverage = harness.exercised.lock().expect("the coverage set").clone();
    let mut unexercised = Vec::new();
    for (path, operations) in harness.spec["paths"]
        .as_object()
        .expect("the spec declares paths")
    {
        for method in operations
            .as_object()
            .expect("operations are keyed by method")
            .keys()
        {
            if !coverage.contains(&(method.clone(), path.clone())) {
                unexercised.push(format!("{} {}", method.to_uppercase(), path));
            }
        }
    }
    assert!(
        unexercised.is_empty(),
        "every operation the contract declares must be exercised; missing: {unexercised:?}"
    );
}

#[tokio::test]
async fn the_store_schema_takes_effect() {
    let client = mongodb::Client::with_uri_str(&store_uri())
        .await
        .expect("the store address parses");
    let database = client.database(&format!("schema_{}", std::process::id()));
    database.drop().await.expect("a clean database");
    let _store = MongoNoteStore::initialize(database.clone())
        .await
        .expect("the store initializes");

    let raw = database.collection::<mongodb::bson::Document>(store_mongo::NOTES_COLLECTION);
    let invalid = raw.insert_one(mongodb::bson::doc! { "body": 42 }).await;
    assert!(
        invalid.is_err(),
        "the $jsonSchema validator refuses a malformed document"
    );

    let indexes = database
        .collection::<mongodb::bson::Document>(store_mongo::NOTES_COLLECTION)
        .list_index_names()
        .await
        .expect("index names are listable");
    assert!(
        indexes
            .iter()
            .any(|name| name == store_mongo::CREATED_AT_INDEX)
    );

    let ledger: Option<mongodb::bson::Document> = database
        .collection::<mongodb::bson::Document>(store_mongo::migrations::LEDGER_COLLECTION)
        .find_one(mongodb::bson::doc! { "_id": store_mongo::migrations::SCHEMA_VERSION })
        .await
        .expect("the ledger is readable");
    assert!(
        ledger.is_some(),
        "the applied-migrations ledger records the schema version"
    );
}

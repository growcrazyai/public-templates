use std::process::ExitCode;

fn main() -> ExitCode {
    let (_router, openapi) = http_boundary::api();
    match openapi.to_pretty_json() {
        Ok(json) => {
            println!("{json}");
            ExitCode::SUCCESS
        }
        Err(error) => {
            eprintln!("the contract cannot be serialized: {error}");
            ExitCode::FAILURE
        }
    }
}

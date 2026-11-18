#![doc = "Official Vercel Rust Runtime (`vercel_runtime`) HTTP handler for ay-vercel health and metadata."]
#![forbid(unsafe_code)]

use http::StatusCode;
use serde::Serialize;
use vercel_runtime::{Error, Request, Response, ResponseBody};

/// JSON status payload returned by the Vercel Rust Runtime handler.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RuntimeHealth {
    /// Service status flag.
    pub ok: bool,
    /// Product identifier.
    pub service: &'static str,
    /// Runtime stack name.
    pub runtime: &'static str,
}

/// Builds the JSON health response backed by [`ResponseBody`].
///
/// # Errors
/// Returns [`vercel_runtime::Error`] if response serialization or construction fails.
pub fn build_health_response() -> Result<Response<ResponseBody>, Error> {
    let payload = serde_json::to_string(&RuntimeHealth {
        ok: true,
        service: "ay-vercel",
        runtime: "vercel_runtime",
    })?;
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header("content-type", "application/json; charset=utf-8")
        .header("cache-control", "no-store")
        .body(ResponseBody::from(payload))?)
}

/// Handles an incoming Vercel serverless request using `vercel_runtime::Request`.
///
/// # Errors
/// Returns [`vercel_runtime::Error`] if response serialization or construction fails.
pub async fn handle_health(_req: Request) -> Result<Response<ResponseBody>, Error> {
    build_health_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn returns_ok_json_health_response() -> Result<(), Error> {
        let resp = build_health_response()?;
        assert_eq!(resp.status(), StatusCode::OK);
        Ok(())
    }
}

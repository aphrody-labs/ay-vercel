#![doc = "Pure-Rust Next.js engine extracted from `frameworks/next.js` without Node.js N-API bindings."]
#![forbid(unsafe_code)]

pub use next_api;
pub use next_build::{self, BuildOptions};
pub use next_code_frame;
pub use next_core;
pub use next_custom_transforms;
pub use turbo_tasks;
pub use turbo_tasks_backend;
pub use turbopack_core;

/// Returns the extracted pure-Rust Next.js crate stack.
#[must_use]
pub const fn pure_rust_stack() -> &'static [&'static str] {
    &[
        "next-api",
        "next-build",
        "next-core",
        "next-custom-transforms",
        "next-code-frame",
        "turbopack-core",
        "turbo-tasks",
        "turbo-tasks-backend",
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exposes_pure_rust_next_stack() {
        assert!(pure_rust_stack().contains(&"next-api"));
        assert!(pure_rust_stack().contains(&"next-build"));
        assert!(pure_rust_stack().contains(&"turbopack-core"));
    }
}

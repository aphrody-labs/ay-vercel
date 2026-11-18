#![doc = "Pure-Rust Next.js CLI entrypoint."]
#![forbid(unsafe_code)]

fn main() {
    println!("ay-vercel-next (pure Rust Next.js + Turbopack, zero N-API):");
    for crate_name in ay_vercel_next::pure_rust_stack() {
        println!("  - {crate_name}");
    }
}

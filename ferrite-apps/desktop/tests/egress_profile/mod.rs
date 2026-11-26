//! Shared tests run without outbound bindings on both SDKs. The explicit
//! local-egress profile repeats them with Forge's real deny-all policy.

#[cfg(feature = "local-egress")]
pub const DENIED: bool = true;
#[cfg(not(feature = "local-egress"))]
pub const DENIED: bool = false;

// A missing capability is 503; a declared capability refusing a call is 502.
pub const FAILURE_STATUS: u16 = if DENIED { 502 } else { 503 };

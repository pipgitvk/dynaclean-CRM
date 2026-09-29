/**
 * Next.js instrumentation — Edge-safe entry.
 * Node-only mute logic lives in instrumentation.node.js
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  await import("./instrumentation.node.js");
}
